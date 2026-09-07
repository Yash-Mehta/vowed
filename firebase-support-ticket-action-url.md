Project ID: our-day-39d9d

Summary:
I'm unable to set a custom Action URL (callbackUri) for Authentication email templates (password reset / email verification). Saving fails with error "An error occurred when updating the action URL" in the Console, and the underlying Admin API call returns:

  400 INVALID_ARGUMENT
  message: EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED

Steps to reproduce:
1. Go to Authentication > Templates > any template > Customize action URL
2. Enter a custom domain (I tried both https://auth.vowedsocial.com/__/auth/action and https://vowedsocial.com/__/auth/action)
3. Save
4. Error occurs immediately

What I've already verified/ruled out:
- The custom email-sending domain (vowedsocial.com) is fully DNS-verified and active (useCustomDomain: true in the project config).
- auth.vowedsocial.com is connected as a Firebase Hosting custom domain and is fully active (DOMAIN_ACTIVE status, DNS_MATCH, CERT_ACTIVE via the Hosting API), and correctly serves the default auth action handler page (verified the exact same HTML/fireauth.oob.OobHandler content is returned as the default our-day-39d9d.firebaseapp.com/__/auth/action URL).
- auth.vowedsocial.com has been added to Authentication > Settings > Authorized domains.
- I tested both the Hosting subdomain (auth.vowedsocial.com) and the verified email-sender root domain (vowedsocial.com) directly against the Admin API (identitytoolkit.googleapis.com/v2/projects/our-day-39d9d/config, PATCH with updateMask=notification.sendEmail.callbackUri) — both return the identical EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED error.
- As a control, PATCHing callbackUri back to its own current/default value (https://our-day-39d9d.firebaseapp.com/__/auth/action) succeeds without error. This suggests the block isn't about the specific domain/value, but about changing this field to any non-default value at all.
- UPDATE: I found and completed the Identity Platform upgrade (Authentication > Settings > Advanced > SMS Multi-factor Authentication > "Upgrade to enable"). Confirmed via the Admin API that "subtype" is now "IDENTITY_PLATFORM" (previously "FIREBASE_AUTH") and MFA shows enabled. Retried the callbackUri update immediately after — identical EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED error. This rules out the Identity Platform upgrade as the blocker.
- Also found: "Public-facing name" and "Support email" fields do not appear at all under Project Settings > General for this project — matching a known unresolved Firebase Console issue reported by other users (a Firebase Technical Solutions Engineer confirmed in a public forum thread this is tied to project-level permissions/restrictions and isn't fixable from the Console). This may share the same root cause as the Action URL block. As a visible symptom, our Auth email templates currently render %APP_NAME% as the raw project ID (our-day-39d9d) instead of a friendly name, which is presumably fed by that missing field.

Question for support:
What is actually gating this update, and what needs to change on the project to allow a custom Action URL to be set? I've now ruled out: domain/Hosting verification, authorized domains, and the Identity Platform upgrade. Given the missing "Public-facing name"/"Support email" fields point to a project-level permissions issue, is that the same thing blocking the Action URL customization? Please investigate project-level restrictions on our-day-39d9d specifically.

Desired outcome: successfully set the Action URL to https://auth.vowedsocial.com/__/auth/action so password reset and email verification links show our branded domain instead of our-day-39d9d.firebaseapp.com.

Specifically requesting:
1. Investigate and clear whatever project-level restriction is causing EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED on our-day-39d9d, so I can set a custom Action URL myself going forward.
2. Restore/enable the "Public-facing name" and "Support email" fields under Project Settings > General for our-day-39d9d, so %APP_NAME% resolves to a real app name instead of the project ID.
3. If these can't be self-service fixed, please just manually set the Action URL to https://auth.vowedsocial.com/__/auth/action and the Public-facing name to "Vowed" on our-day-39d9d directly.
