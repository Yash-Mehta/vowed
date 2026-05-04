const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const COROUTINE_H = `/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#pragma once

#include <optional>
#include <type_traits>
#include <variant>

#include <folly/Portability.h>
#include <folly/Utility.h>

#if FOLLY_HAS_COROUTINES

#if (__has_include(<coroutine>) && !defined(LLVM_COROUTINES)) || defined(__cpp_impl_coroutine)
#define FOLLY_USE_STD_COROUTINE 1
#else
#define FOLLY_USE_STD_COROUTINE 0
#endif

#if FOLLY_USE_STD_COROUTINE
#include <coroutine>
#else
#include <experimental/coroutine>
#endif

#endif // FOLLY_HAS_COROUTINES

#if FOLLY_HAS_COROUTINES

namespace folly {
class exception_wrapper;
struct AsyncStackFrame;
} // namespace folly

namespace folly::coro {

#if FOLLY_USE_STD_COROUTINE
namespace impl = std;
#else
namespace impl = std::experimental;
#endif

using impl::coroutine_handle;
using impl::coroutine_traits;
using impl::noop_coroutine;
using impl::noop_coroutine_handle;
using impl::noop_coroutine_promise;
using impl::suspend_always;
using impl::suspend_never;

template <typename T = void>
class ready_awaitable {
  static_assert(!std::is_void<T>::value, "base template unsuitable for void");
 public:
  explicit ready_awaitable(T value)
      noexcept(noexcept(T(FOLLY_DECLVAL(T&&))))
      : value_(static_cast<T&&>(value)) {}
  bool await_ready() noexcept { return true; }
  void await_suspend(coroutine_handle<>) noexcept {}
  T await_resume() noexcept(noexcept(T(FOLLY_DECLVAL(T&&)))) {
    return static_cast<T&&>(value_);
  }
 private:
  T value_;
};

template <>
class ready_awaitable<void> {
 public:
  ready_awaitable() noexcept = default;
  bool await_ready() noexcept { return true; }
  void await_suspend(coroutine_handle<>) noexcept {}
  void await_resume() noexcept {}
};

namespace detail {

struct await_suspend_return_coroutine_fn {
  template <typename A, typename P>
  coroutine_handle<> operator()(A& a, coroutine_handle<P> coro) const
      noexcept(noexcept(a.await_suspend(coro))) {
    using result = decltype(a.await_suspend(coro));
    if constexpr (std::is_same<void, result>::value) {
      a.await_suspend(coro);
      return noop_coroutine();
    } else if constexpr (std::is_same<bool, result>::value) {
      return a.await_suspend(coro) ? noop_coroutine() : coro;
    } else {
      return a.await_suspend(coro);
    }
  }
};
inline constexpr await_suspend_return_coroutine_fn
    await_suspend_return_coroutine{};

} // namespace detail

#if __has_include(<variant>)

template <typename... A>
class variant_awaitable : private std::variant<A...> {
 private:
  using base = std::variant<A...>;
  template <typename Visitor>
  auto visit(Visitor v) {
    return std::visit(v, static_cast<base&>(*this));
  }
 public:
  using base::base;
  auto await_ready() noexcept(
      (noexcept(FOLLY_DECLVAL(A&).await_ready()) && ...)) {
    return visit([&](auto& a) { return a.await_ready(); });
  }
  template <typename P>
  auto await_suspend(coroutine_handle<P> coro) noexcept(
      (noexcept(FOLLY_DECLVAL(A&).await_suspend(coro)) && ...)) {
    auto impl = detail::await_suspend_return_coroutine;
    return visit([&](auto& a) { return impl(a, coro); });
  }
  auto await_resume() noexcept(
      (noexcept(FOLLY_DECLVAL(A&).await_resume()) && ...)) {
    return visit([&](auto& a) { return a.await_resume(); });
  }
};

#endif // __has_include(<variant>)

namespace detail {

struct detect_promise_return_object_eager_conversion_ {
  struct promise_type {
    struct return_object {
      /* implicit */ return_object(promise_type& p) noexcept : promise{&p} {
        promise->object = this;
      }
      ~return_object() {
        if (promise) { promise->object = nullptr; }
      }
      promise_type* promise;
    };
    ~promise_type() {
      if (object) { object->promise = nullptr; }
    }
    suspend_never initial_suspend() const noexcept { return {}; }
    suspend_never final_suspend() const noexcept { return {}; }
    void unhandled_exception() {}
    return_object get_return_object() noexcept { return {*this}; }
    void return_void() {}
    return_object* object = nullptr;
  };

  /* implicit */ detect_promise_return_object_eager_conversion_(
      promise_type::return_object const& o) noexcept
      : eager{!!o.promise} {}
  ~detect_promise_return_object_eager_conversion_() {}
  bool eager = false;

  static detect_promise_return_object_eager_conversion_ go() noexcept {
    FOLLY_PUSH_WARNING
#if defined(__clang__) && \\
    (13 < __clang_major__ && __clang_major__ < 17 - defined(__APPLE__))
    FOLLY_CLANG_DISABLE_WARNING("-Wdeprecated-experimental-coroutine")
#endif
    co_return;
    FOLLY_POP_WARNING
  }
};

} // namespace detail

inline bool detect_promise_return_object_eager_conversion() {
  using coro = detail::detect_promise_return_object_eager_conversion_;
  constexpr auto t = kMscVer && kMscVer < 1925;
  constexpr auto f = (kGnuc && !kIsClang) || (kMscVer >= 1925);
  return t ? true : f ? false : coro::go().eager;
}

template <typename>
class ExtendedCoroutinePromiseCrtp;

namespace detail {
template <typename, typename, typename>
class TaskPromiseWrapperBase;
}

class ExtendedCoroutineHandle {
 protected:
  template <typename>
  friend class ExtendedCoroutinePromiseCrtp;
  template <typename, typename, typename>
  friend class detail::TaskPromiseWrapperBase;
  class PrivateTag {
   private:
    friend ExtendedCoroutineHandle;
    PrivateTag() = default;
  };

 private:
  template <typename T>
  using use_extended_handle_of_ = typename T::use_extended_handle_concept;

  template <typename T, typename Void = void>
  struct use_extended_handle {
    static_assert(require_sizeof<T>, "\`use_extended_handle\` on incomplete type");
    static constexpr bool value = false;
  };

  template <typename T>
  struct use_extended_handle<T, void_t<use_extended_handle_of_<T>>> {
    static constexpr bool value =
        std::is_same_v<use_extended_handle_of_<T>, PrivateTag>;
  };

 public:
  using ErrorHandle = std::pair<ExtendedCoroutineHandle, AsyncStackFrame*>;

  class PromiseBase {
   private:
    friend class ExtendedCoroutineHandle;
    template <typename>
    friend class ExtendedCoroutinePromiseCrtp;
    using Fn = std::optional<ErrorHandle>(PromiseBase*, exception_wrapper& ex);
    explicit PromiseBase(Fn* fn) : getErrorHandlePtr_(fn) {}
    ~PromiseBase() = default;
    Fn* getErrorHandlePtr_;
  };

  template <typename Promise>
  /*implicit*/ ExtendedCoroutineHandle(
      coroutine_handle<Promise> handle) noexcept
      : basic_(handle), extended_(fromBasic(handle)) {}

  /*implicit*/ ExtendedCoroutineHandle(coroutine_handle<> handle) noexcept
      : basic_(handle) {}

  template <
      typename Promise,
      std::enable_if_t<use_extended_handle<Promise>::value, int> = 0>
  /*implicit*/ ExtendedCoroutineHandle(Promise* promise) noexcept
      : basic_(coroutine_handle<Promise>::from_promise(*promise)),
        extended_(Promise::getPromiseBase(PrivateTag{}, promise)) {}

  ExtendedCoroutineHandle() noexcept = default;
  void resume() { basic_.resume(); }
  void destroy() { basic_.destroy(); }
  coroutine_handle<> getHandle() const noexcept { return basic_; }

  ErrorHandle getErrorHandle(exception_wrapper& ex) {
    if (extended_) {
      if (auto res = extended_->getErrorHandlePtr_(extended_, ex)) {
        return *res;
      }
    }
    return {basic_, nullptr};
  }

  explicit operator bool() const noexcept { return !!basic_; }

 private:
  template <typename Promise>
  static auto fromBasic(coroutine_handle<Promise> handle) noexcept {
    if constexpr (use_extended_handle<Promise>::value) {
      return Promise::getPromiseBase(PrivateTag{}, &handle.promise());
    } else {
      return nullptr;
    }
  }

  coroutine_handle<> basic_;
  PromiseBase* extended_{nullptr};
};

template <typename Promise>
class ExtendedCoroutinePromiseCrtp
    : public ExtendedCoroutineHandle::PromiseBase {
 public:
  using use_extended_handle_concept = ExtendedCoroutineHandle::PrivateTag;

  static ExtendedCoroutineHandle::PromiseBase* getPromiseBase(
      ExtendedCoroutineHandle::PrivateTag, ExtendedCoroutinePromiseCrtp* me) {
    return me;
  }

 protected:
  using PromiseBase = typename ExtendedCoroutineHandle::PromiseBase;
  ExtendedCoroutinePromiseCrtp()
      : PromiseBase(+[](PromiseBase* p, exception_wrapper& ex) {
          return Promise::getErrorHandleImpl(*static_cast<Promise*>(p), ex);
        }) {}
  ~ExtendedCoroutinePromiseCrtp() = default;
};

} // namespace folly::coro

#endif
`;

module.exports = function withCxx20(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const iosRoot = config.modRequest.platformProjectRoot;

      // Write the real Coroutine.h so the post_install hook can copy it
      const patchDir = path.join(iosRoot, 'FollyPatch', 'folly', 'coro');
      fs.mkdirSync(patchDir, { recursive: true });
      fs.writeFileSync(path.join(patchDir, 'Coroutine.h'), COROUTINE_H, 'utf-8');

      const podfilePath = path.join(iosRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf-8');

      if (contents.includes('CLANG_CXX_LANGUAGE_STANDARD')) {
        return config;
      }

      const injection = `
    # Set C++20 for all targets (required by Folly in RN 0.81)
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |cfg|
        cfg.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
      end
    end

    # Copy missing folly/coro/Coroutine.h into ReactNativeDependencies headers
    require 'fileutils'
    folly_coro_dir = File.join(installer.sandbox.root, 'Headers/Public/ReactNativeDependencies/folly/coro')
    FileUtils.mkdir_p(folly_coro_dir)
    src = File.join(__dir__, 'FollyPatch/folly/coro/Coroutine.h')
    dst = File.join(folly_coro_dir, 'Coroutine.h')
    FileUtils.cp(src, dst)

    # Fix ReanimatedMountHook: registry reanimated 3.16.7 uses 'double' but
    # RN 0.81's UIManagerMountHook uses HighResTimeStamp — patch both files.
    # The registry .h has 'double mountTime) noexcept override'
    # The registry .cpp has 'double) noexcept {' (unnamed param)
    [
      File.join(installer.sandbox.root, 'Headers/Private/RNReanimated/reanimated/Fabric/ReanimatedMountHook.h'),
      File.join(__dir__, '..', 'node_modules', 'react-native-reanimated', 'Common', 'cpp', 'reanimated', 'Fabric', 'ReanimatedMountHook.h'),
      File.join(__dir__, '..', 'node_modules', 'react-native-reanimated', 'Common', 'cpp', 'reanimated', 'Fabric', 'ReanimatedMountHook.cpp'),
    ].each do |f|
      next unless File.exist?(f)
      content = File.read(f)
      patched = content
        .gsub('double mountTime) noexcept override', 'HighResTimeStamp mountTime) noexcept override')
        .gsub('double /*mountTime*/) noexcept', 'HighResTimeStamp /*mountTime*/) noexcept')
        .gsub('double) noexcept', 'HighResTimeStamp) noexcept')
      if patched != content
        File.write(f, patched)
        puts "patched #{File.basename(f)}: double -> HighResTimeStamp"
      end
    end
`;

      contents = contents.replace(
        /post_install do \|installer\|/,
        `post_install do |installer|\n${injection}`
      );
      fs.writeFileSync(podfilePath, contents, 'utf-8');

      return config;
    },
  ]);
};
