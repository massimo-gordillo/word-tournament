import { useRef } from 'react'
import { Alert, Platform, View, StyleSheet } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { copy } from '@/app/copy/strings'
import { devLog } from '@/utils/logger'

const buildAppleDisplayName = (givenName: string, familyName?: string | null) => {
  const trimmedGivenName = givenName.trim()
  const trimmedFamilyName = familyName?.trim()
  const lastInitial = trimmedFamilyName ? trimmedFamilyName.charAt(0).toUpperCase() : ''
  return `${trimmedGivenName}${lastInitial ? ` ${lastInitial}` : ''}`
}

const isAppleSignInCanceled = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'ERR_REQUEST_CANCELED'

const getAppleSignInErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.message === 'No identity token returned from Apple') {
      return copy.auth.login.appleSignInNoToken
    }
    if (error.message.includes('no Supabase session')) {
      return copy.auth.login.appleSignInNoSession
    }
    if (error.message.trim().length > 0) {
      return error.message
    }
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String((error as { message?: string }).message ?? '').trim()
    if (message.length > 0) {
      return message
    }
  }

  return copy.auth.login.appleSignInGenericError
}

type AppleSignInButtonProps = {
  disabled?: boolean
  onSignInStart?: () => void
  onSignInEnd?: () => void
}

export function AppleSignInButton({
  disabled = false,
  onSignInStart,
  onSignInEnd,
}: AppleSignInButtonProps) {
  const signInInFlightRef = useRef(false)

  if (Platform.OS !== 'ios') return null

  const handleAppleSignIn = async () => {
    if (disabled || signInInFlightRef.current) {
      return
    }

    signInInFlightRef.current = true
    onSignInStart?.()

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

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      })

      if (error) throw error

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (!sessionData.session) {
        throw new Error('Apple sign-in completed, but no Supabase session was created.')
      }

      const fullName = credential.fullName
      if (fullName?.givenName) {
        const displayName = buildAppleDisplayName(fullName.givenName, fullName.familyName)

        await supabase.auth.updateUser({
          data: {
            display_name: displayName,
            full_name: `${fullName.givenName} ${fullName.familyName ?? ''}`.trim(),
            given_name: fullName.givenName,
            family_name: fullName.familyName ?? '',
            first_name: fullName.givenName,
            last_name: fullName.familyName ?? '',
          },
        })

        const { data: userData } = await supabase.auth.getUser()
        const userId = userData.user?.id
        if (userId) {
          await supabase
            .from('users')
            .update({ display_name: displayName })
            .eq('id', userId)
        }
      }

      router.replace('/(tabs)')
    } catch (error: unknown) {
      if (isAppleSignInCanceled(error)) {
        return
      }

      const message = getAppleSignInErrorMessage(error)
      devLog('Apple sign in error', error)
      Alert.alert(copy.auth.login.appleSignInFailedTitle, message)
    } finally {
      signInInFlightRef.current = false
      onSignInEnd?.()
    }
  }

  const isInteractionBlocked = disabled

  return (
    <View
      style={[styles.wrapper, isInteractionBlocked && styles.wrapperDisabled]}
      pointerEvents={isInteractionBlocked ? 'none' : 'auto'}
    >
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={5}
        style={styles.button}
        onPress={handleAppleSignIn}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  wrapperDisabled: {
    opacity: 0.5,
  },
  button: {
    width: '100%',
    height: 50,
    marginBottom: 16
  },
})
