// firebase/auth's package.json "exports" map lists the generic "types"
// condition before the "react-native" condition, so tsc always resolves
// to the web/node typings and never sees getReactNativePersistence, even
// though Metro correctly resolves the RN runtime build. This augments the
// module's types to match what actually ships in dist/rn/index.rn.d.ts.
import { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  interface ReactNativeAsyncStorage {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }

  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
