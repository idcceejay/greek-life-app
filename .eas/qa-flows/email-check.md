Check that the sign-in screen rejects an email address without an @.

1. The app opens on the screen with the title "Sign in". Save a screenshot.
2. Tap the email field, and type rally-test, with no @. Save a screenshot.
3. Tap "Send code". Save a screenshot.
4. Check that the text "Enter a valid email address." shows under the email field, and that the title is still "Sign in".

Out of scope for this lane: do not type an email address that has an @, and do not tap "Send code" after you type one. That sends a real sign-in email and creates an account. Do not sign in.

Pass condition: after step 3, the screen shows "Enter a valid email address." and the title "Sign in", and the "Check your email" screen does not open.
