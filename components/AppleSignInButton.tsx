import { Platform } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { supabase } from '@/lib/supabase'; // adjust path to your client

export function AppleSignInButton() {
  // Apple Sign In is iOS only
  if (Platform.OS !== 'ios') return null

  const handleAppleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      })

      if (!credential.identityToken) {
        throw new Error('No identity token returned from Apple')
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      })

      if (error) throw error

      // Apple only gives you the full name on the VERY FIRST sign-in.
      // Capture and save it immediately if present.
      const fullName = credential.fullName
      if (fullName?.givenName) {
        await supabase.auth.updateUser({
          data: {
            first_name: fullName.givenName,
            last_name: fullName.familyName ?? '',
            full_name: `${fullName.givenName} ${fullName.familyName ?? ''}`.trim(),
          },
        })
      }

    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') {
        // User cancelled — no need to show an error
        return
      }
      console.error('Apple sign in error:', e)
      // Show your error UI here
    }
  }

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={5}
      style={{ width: '100%', height: 50 }}
      onPress={handleAppleSignIn}
    />
  )
}