const copyEntries = {
  // COPY_ENTRIES_START
  'account.appInfoSection': 'App Information',
  'account.displayNameLabel': 'Display Name',
  'account.displayNameMaxError': 'Display name must be {max} characters or less',
  'account.displayNameMinError': 'Display name must be at least {min} characters',
  'account.emailSection': 'Email',
  'account.emptyDisplayName': 'Display name cannot be empty',
  'account.placeholder': 'Your display name',
  'account.profileSection': 'Profile Information',
  'account.saveChanges': 'Save Changes',
  'account.sectionActions': 'Account Actions',
  'account.signOut': 'Sign Out',
  'account.successUpdated': 'Profile updated successfully',
  'account.title': 'Account',
  'account.userIdLabel': 'User ID',
  'account.versionLabel': 'Version',
  'auth.checkEmail.backPrefix': 'Back to',
  'auth.checkEmail.bodyRecovery': 'If an account exists for that address, we sent a password reset link. Open it on this device to choose a new password.',
  'auth.checkEmail.bodySignup': 'We sent a confirmation link to your inbox. Open it on this device to finish signing up.',
  'auth.checkEmail.messageSent': 'Message sent.',
  'auth.checkEmail.missingEmail': 'Missing email. Go back and try again.',
  'auth.checkEmail.resendButton': 'Resend email',
  'auth.checkEmail.signInBold': 'Sign In',
  'auth.checkEmail.titleRecovery': 'Check your email',
  'auth.checkEmail.titleSignup': 'Confirm your email',
  'auth.forgotPassword.backToSignIn': 'Back to Sign In',
  'auth.forgotPassword.emailPlaceholder': 'Email',
  'auth.forgotPassword.enterEmailError': 'Please enter your email',
  'auth.forgotPassword.sendButton': 'Send reset link',
  'auth.forgotPassword.subtitle': 'We\'ll email you a link to reset it.',
  'auth.forgotPassword.title': 'Forgot password',
  'auth.login.emailPlaceholder': 'Email',
  'auth.login.fillAllFieldsError': 'Please fill in all fields',
  'auth.login.forgotPassword': 'Forgot password?',
  'auth.login.noAccountPrefix': 'Don\'t have an account?',
  'auth.login.passwordPlaceholder': 'Password',
  'auth.login.signInButton': 'Sign In',
  'auth.login.signUpCta': 'Sign Up',
  'auth.login.subtitle': 'Track your daily Wordle scores',
  'auth.login.title': 'Word Tournaments',
  'auth.resetPassword.backToSignIn': 'Back to Sign In',
  'auth.resetPassword.chooseSubtitle': 'Enter and confirm your new password.',
  'auth.resetPassword.chooseTitle': 'Choose a new password',
  'auth.resetPassword.confirmPlaceholder': 'Confirm new password',
  'auth.resetPassword.fillAllFieldsError': 'Please fill in all fields',
  'auth.resetPassword.forgotPasswordLink': 'Forgot password',
  'auth.resetPassword.newPasswordPlaceholder': 'New password',
  'auth.resetPassword.passwordsMismatchError': 'Passwords do not match',
  'auth.resetPassword.passwordTooShortError': 'Password must be at least 6 characters',
  'auth.resetPassword.updateButton': 'Update password',
  'auth.resetPassword.waitingSubtitle': 'Open the reset link from your email on this device. If you already did, try requesting a new link from Forgot password.',
  'auth.resetPassword.waitingTitle': 'Reset password',
  'auth.signup.alreadyHavePrefix': 'Already have an account?',
  'auth.signup.confirmPasswordPlaceholder': 'Confirm password',
  'auth.signup.createButton': 'Create Account',
  'auth.signup.displayNameMaxError': 'Display name must be {max} characters or less',
  'auth.signup.displayNameMinError': 'Display name must be at least {min} characters',
  'auth.signup.displayNamePlaceholder': 'Display name',
  'auth.signup.emailPlaceholder': 'Email',
  'auth.signup.fillAllFieldsError': 'Please fill in all fields',
  'auth.signup.passwordPlaceholder': 'Password (min 6 characters)',
  'auth.signup.passwordsMismatchError': 'Passwords do not match',
  'auth.signup.passwordTooShortError': 'Password must be at least 6 characters',
  'auth.signup.signInCta': 'Sign In',
  'auth.signup.subtitle': 'Join Word-L Series tournament',
  'auth.signup.title': 'Create Account',
  'dailySubmission.closedInputPlaceholder': 'Submission window closed',
  'dailySubmission.closedSubmitButton': 'Submission Closed',
  'dailySubmission.closedWindow': 'Submission window closed, opens tomorrow at 12:01AM EST',
  'dailySubmission.cutoffCountdownSuffix': 'until cutoff',
  'dailySubmission.dbInvalidGridError': 'Invalid Wordle grid. Please paste the complete result including the emoji rows.',
  'dailySubmission.dbSaveFallbackError': 'Unable to save submission',
  'dailySubmission.emptySubmissionError': 'Paste your result for today\'s Wordle',
  'dailySubmission.formTitle': 'Daily Submission',
  'dailySubmission.instruction1': 'Play today\'s Wordle on the NYT website',
  'dailySubmission.instruction2': '2. Tap the Share button',
  'dailySubmission.instruction3': '3. Paste the complete result below',
  'dailySubmission.instructionsTitle': 'How to submit:',
  'dailySubmission.introModal.createSectionTitle': 'How to create a tournament',
  'dailySubmission.introModal.createStep1': '1. Open the Manage tab and create a tournament',
  'dailySubmission.introModal.createStep2': '2. Copy the join code and share with your friends',
  'dailySubmission.introModal.createStep3': '3. View the tournament in drafts and start it when you\'re ready',
  'dailySubmission.introModal.dismissButton': 'Got it',
  'dailySubmission.introModal.joinSectionTitle': 'How to join a tournament',
  'dailySubmission.introModal.joinStep1': '1. Ask your friend who created the tournament to share the join code',
  'dailySubmission.introModal.joinStep2': '2. Go to the ongoing tournaments tab and click \'join by code\'',
  'dailySubmission.introModal.joinStep3': '3. Paste the code and click \'join\'. Your friend will start the tournament when everyone has joned',
  'dailySubmission.introModal.submitSectionTitle': 'How to submit your score',
  'dailySubmission.introModal.submitStep1': 'Play today\'s Wordle on the NYT website',
  'dailySubmission.introModal.submitStep2': '2. Click the share button to copy the result',
  'dailySubmission.introModal.submitStep3': '3. Paste the full result on this screen',
  'dailySubmission.introModal.title': 'Welcome to Word-L Series',
  'dailySubmission.invalidGridError': 'Invalid Wordle game grid. Please paste the complete result including the emoji rows.',
  'dailySubmission.nextSubmissionInfo': 'Come back tomorrow for your next submission!',
  'dailySubmission.openInputPlaceholder': 'Paste your Wordle result here...',
  'dailySubmission.parseFailedError': 'Something went wrong reading your result. Please try pasting it again.',
  'dailySubmission.pastCutoffError': 'Submission for today is closed, you can submit tomorrow\'s starting at 12:01AM EST.',
  'dailySubmission.scoreAppliedInfo': 'Your score has been applied to all active tournaments you\'re participating in.',
  'dailySubmission.submitButton': 'Submit',
  'dailySubmission.todayDateLabel': 'Today',
  'dailySubmission.todaySubmissionTitle': 'Today\'s Submission',
  'draftTournament.copyButton': 'Copy',
  'draftTournament.discardBody': 'This will cancel the tournament and remove it from your drafts. This cannot be undone.',
  'draftTournament.discardButton': 'Discard tournament',
  'draftTournament.discardDestructive': 'Discard',
  'draftTournament.discardFailed': 'Failed to discard tournament',
  'draftTournament.discardKeep': 'Keep draft',
  'draftTournament.discardTitle': 'Discard tournament',
  'draftTournament.duration14': '2 weeks',
  'draftTournament.duration28': '4 weeks',
  'draftTournament.duration3': '3 days',
  'draftTournament.duration7': '7 days',
  'draftTournament.durationDaysTemplate': '{days} days',
  'draftTournament.joinCodeLabel': 'Join code ',
  'draftTournament.leaveBody': 'Are you sure you want to leave this draft tournament?',
  'draftTournament.leaveButton': 'Leave',
  'draftTournament.leaveTitle': 'Leave tournament',
  'draftTournament.leaveTournament': 'Leave Tournament',
  'draftTournament.leaveWebConfirm': 'Leave this draft tournament?',
  'draftTournament.needTwoPlayers': 'You need at least 2 players to start the tournament',
  'draftTournament.noPlayersYet': 'No players yet',
  'draftTournament.notEnoughPlayersBody': 'At least 2 players must still be in the tournament to start it.',
  'draftTournament.notEnoughPlayersTitle': 'Not enough players',
  'draftTournament.notFound': 'Tournament not found',
  'draftTournament.permissionDeniedBody': 'Only the tournament creator can start this tournament.',
  'draftTournament.permissionDeniedTitle': 'Permission denied',
  'draftTournament.playersTitleTemplate': 'Players ({current}/{max})',
  'draftTournament.removeAlertBody': 'Remove this player from the tournament? They will not be able to re-join.',
  'draftTournament.removeAlertCancel': 'Cancel',
  'draftTournament.removeAlertRemove': 'Remove',
  'draftTournament.removeAlertTitle': 'Remove player',
  'draftTournament.removeWebTemplate': 'Remove {name} from this tournament?\\n\\nThey will not be able to re-join.',
  'draftTournament.startButton': 'Start tournament',
  'draftTournament.tournamentLengthLabel': 'Tournament length',
  'draftTournament.unableLeaveGeneric': 'Could not leave this tournament.',
  'draftTournament.unableLeaveTitle': 'Unable to leave',
  'draftTournament.unableStartGenericBody': 'Please refresh and try again.',
  'draftTournament.unableStartGenericTitle': 'Unable to start tournament',
  'draftTournament.unableStartNotDraftBody': 'This tournament is no longer in draft status.',
  'draftTournament.unableStartNotDraftTitle': 'Unable to start',
  'draftTournament.waitingMessageNonCreator': 'You\'re in this tournament. The host will start it when everyone is ready.',
  'draftTournament.waitingPlayersSubtext': 'Waiting for players to join...',
  'draftTournament.waitingTitle': 'Waiting',
  'manage.backToMenu': '← Back to Menu',
  'manage.cancel': 'Cancel',
  'manage.closedStatus': 'Closed',
  'manage.create': 'Create',
  'manage.createGenericError': 'Unable to create tournament',
  'manage.createSubtitle': 'Start a new tournament',
  'manage.createTitle': 'Create Tournament',
  'manage.defaultTournamentNameTemplate': '{name}\'s tournament',
  'manage.draftsSubtitle': 'Tournaments awaiting players',
  'manage.draftStatus': 'Draft',
  'manage.draftsTitle': 'Open Drafts',
  'manage.duration14': '2 weeks',
  'manage.duration28': '4 weeks',
  'manage.duration3': '3 days',
  'manage.duration7': '7 days',
  'manage.durationLabel': 'Duration',
  'manage.emptyDraftsSubtext': 'Create a tournament to get started',
  'manage.emptyDraftsTitle': 'No draft tournaments',
  'manage.emptyPastSubtext': 'Tournaments you participated in will appear here once they end or if you forfeit',
  'manage.emptyPastTitle': 'No past tournaments',
  'manage.forfeitedStatus': 'Forfeited',
  'manage.headerTitle': 'Tournament Management',
  'manage.joinCodeSecondaryPrefix': 'Join Code: ',
  'manage.limitModalBody': 'You have hit your limit of {max} continuous tournaments. Delete a draft tournament you\'ve created, leave a tournament, or wait for an ongoing tournament to complete.',
  'manage.limitModalTitle': 'Tournament limit reached',
  'manage.loadingTournamentName': 'Loading...',
  'manage.loadUserError': 'Unable to load user information',
  'manage.maxTournamentsError': 'You are already in the maximum number of tournaments ({max})',
  'manage.modalCreateTitle': 'Create Tournament',
  'manage.ok': 'OK',
  'manage.pastSubtitle': 'View completed tournaments',
  'manage.pastTitle': 'Past Tournaments',
  'manage.startDateLabel': 'Start Date',
  'manage.startDateValue': 'When tournament is started',
  'manage.tournamentNameLabel': 'Tournament Name',
  'manage.yourTournament': 'Your Tournament',
  'stats.averageScore': 'Average Score',
  'stats.averageSubtext': 'Excluding penalties',
  'stats.bestScoreSection': 'Best Score',
  'stats.guess1': '1 Guess',
  'stats.guess2': '2 Guesses',
  'stats.guess3': '3 Guesses',
  'stats.guess4': '4 Guesses',
  'stats.guess5': '5 Guesses',
  'stats.guess6': '6 Guesses',
  'stats.guess6PointSuffix': 'point',
  'stats.missedFailed': 'Missed/Failed',
  'stats.na': 'N/A',
  'stats.participationSubtext': 'Total participation',
  'stats.pointsSuffix': 'points',
  'stats.scoringGuide': 'Scoring Guide',
  'stats.submissionsSubtext': 'Wordle scores submitted',
  'stats.title': 'Statistics',
  'stats.totalSubmissions': 'Total Submissions',
  'stats.tournamentsLabel': 'Tournaments',
  'stats.tournamentWins': 'Tournament Wins',
  'stats.winsSubtext': '1st place finishes',
  'tabs.account': 'Account',
  'tabs.manage': 'Manage',
  'tabs.ongoing': 'Ongoing',
  'tabs.statistics': 'Statistics',
  'tabs.submit': 'Submit',
  'tournamentChat.emptyMessages': 'No messages yet',
  'tournamentChat.messagePlaceholder': 'Message…',
  'tournamentChat.resultLockedTemplate': '{name} has submitted their result',
  'tournamentChat.resultUnavailable': 'Result unavailable',
  'tournamentChat.sectionTitle': 'Tournament Chat',
  'tournamentChat.sendA11y': 'Send message',
  'tournamentDetail.allSubmissions': 'All Submissions',
  'tournamentDetail.cancel': 'Cancel',
  'tournamentDetail.championFanfare': 'Champion! 🏆',
  'tournamentDetail.codeSecondaryPrefix': 'Code: ',
  'tournamentDetail.cutoffAmTemplate': '{hour} AM',
  'tournamentDetail.cutoffMidnight': 'midnight',
  'tournamentDetail.cutoffNoon': 'noon',
  'tournamentDetail.cutoffPmTemplate': '{hour} PM',
  'tournamentDetail.datesLabel': 'Dates',
  'tournamentDetail.emptyNoPlayers': 'No players in this tournament',
  'tournamentDetail.emptyNoScores': 'No scores yet',
  'tournamentDetail.emptyNoSubmissions': 'No submissions yet',
  'tournamentDetail.forfeit': 'Forfeit',
  'tournamentDetail.forfeitAlertBody': 'Are you sure you want to forfeit this tournament? This will mark you as forfeited and you will receive a -2 penalty for every remaining day of this tournament. This cannot be undone.',
  'tournamentDetail.forfeitAlertTitle': 'Forfeit Tournament',
  'tournamentDetail.forfeitAlreadyBody': 'You have already forfeited this tournament.',
  'tournamentDetail.forfeitAlreadyTitle': 'Already forfeited',
  'tournamentDetail.forfeitButton': 'Forfeit Tournament',
  'tournamentDetail.forfeitErrorBody': 'Could not forfeit the tournament. Please try again.',
  'tournamentDetail.forfeitErrorTitle': 'Error',
  'tournamentDetail.forfeiting': 'Forfeiting...',
  'tournamentDetail.forfeitSuffix': ' (Forfeit)',
  'tournamentDetail.headerEndedOn': 'Ended on: ',
  'tournamentDetail.headerEndsOn': 'Ends on: ',
  'tournamentDetail.joinCodeLabel': 'Join Code',
  'tournamentDetail.leaderboardFinal': 'Final Standings',
  'tournamentDetail.leaderboardToday': 'Today\'s Leaderboard',
  'tournamentDetail.leaderboardWaiting': 'Leaderboard (Waiting)',
  'tournamentDetail.leaderboardYesterdayWaiting': 'Yesterday\'s Leaderboard (Waiting)',
  'tournamentDetail.notFound': 'Tournament not found',
  'tournamentDetail.playersSection': 'Players',
  'tournamentDetail.playerStatusForfeited': 'Forfeited',
  'tournamentDetail.playerStatusNoSubmission': 'No submission',
  'tournamentDetail.playerStatusSubmitted': 'Submitted',
  'tournamentDetail.playerStatusWaiting': 'Waiting',
  'tournamentDetail.pointsSuffix': ' pts',
  'tournamentDetail.resultsWaitingSubtext': 'Results will be available after all active players submit or at {cutoff} EST',
  'tournamentDetail.resultsWaitingTitle': 'Waiting for today\'s submissions...',
  'tournamentDetail.statusActive': 'Active',
  'tournamentDetail.statusClosed': 'Closed',
  'tournamentDetail.statusDraft': 'Draft',
  'tournamentDetail.statusJoined': 'Joined',
  'tournamentDetail.statusLabel': 'Status',
  'tournamentDetail.tournamentInfo': 'Tournament Info',
  'tournamentDetail.unknownPlayer': 'Unknown',
  'tournamentDetail.waitingSubmissionsDay': 'Waiting on Submissions',
  'tournamentDetail.youSuffix': ' (You)',
  'tournaments.alreadyInTournament': 'You are already in this tournament',
  'tournaments.cancel': 'Cancel',
  'tournaments.codeSecondaryPrefix': 'Code: ',
  'tournaments.completedSection': 'Recently Completed Tournaments ({count})',
  'tournaments.emptySubtext': 'Join a tournament using a code',
  'tournaments.emptyTitle': 'No joined tournaments',
  'tournaments.headerTitle': 'Joined Tournaments',
  'tournaments.invalidJoinCode': 'Invalid join code',
  'tournaments.join': 'Join',
  'tournaments.joinByCode': 'Join by Code',
  'tournaments.joinCodeEmpty': 'Please enter a join code',
  'tournaments.joinGenericError': 'Unable to join tournament',
  'tournaments.joinModalSubtitle': 'Enter the tournament join code',
  'tournaments.joinModalTitle': 'Join Tournament',
  'tournaments.joinPlaceholder': 'Join Code (e.g., ABC123)',
  'tournaments.limitModalBody': 'You have hit your limit of {max} continuous tournaments. Delete a draft tournament you\'ve created, leave a tournament, or wait for an ongoing tournament to complete.',
  'tournaments.limitModalTitle': 'Tournament limit reached',
  'tournaments.maxTournamentsTemplate': 'You are already in the maximum number of tournaments ({max})',
  'tournaments.ok': 'OK',
  'tournaments.ongoingSection': 'Ongoing Tournaments ({count})',
  'tournaments.statusActive': 'Active',
  'tournaments.statusClosed': 'Closed',
  'tournaments.statusDraft': 'Draft',
  'tournaments.statusJoined': 'Joined',
  'tournaments.tournamentFullTemplate': 'This tournament is full ({max} players max)',
  'tournaments.yourTournament': 'Your Tournament',
// COPY_ENTRIES_END
} as const;

export function fillCopyTemplate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function buildCopy(entries: Record<string, string>) {
  const root: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entries)) {
    const path = key.split('.');
    let cursor: Record<string, unknown> = root;
    for (let index = 0; index < path.length - 1; index += 1) {
      const segment = path[index];
      const next = cursor[segment];
      if (!next || typeof next !== 'object') {
        cursor[segment] = {};
      }
      cursor = cursor[segment] as Record<string, unknown>;
    }
    cursor[path[path.length - 1]] = value;
  }
  return root;
}

export interface CopySchema {
  tabs: {
    submit: string;
    ongoing: string;
    manage: string;
    statistics: string;
    account: string;
  };
  auth: {
    login: {
      title: string;
      subtitle: string;
      emailPlaceholder: string;
      passwordPlaceholder: string;
      signInButton: string;
      forgotPassword: string;
      noAccountPrefix: string;
      signUpCta: string;
      fillAllFieldsError: string;
    };
    signup: Record<string, string>;
    forgotPassword: Record<string, string>;
    resetPassword: Record<string, string>;
    checkEmail: Record<string, string>;
  };
  dailySubmission: {
    closedWindow: string;
    cutoffCountdownSuffix: string;
    emptySubmissionError: string;
    pastCutoffError: string;
    invalidGridError: string;
    parseFailedError: string;
    dbSaveFallbackError: string;
    dbInvalidGridError: string;
    todaySubmissionTitle: string;
    todayDateLabel: string;
    scoreAppliedInfo: string;
    nextSubmissionInfo: string;
    introModal: {
      title: string;
      submitSectionTitle: string;
      submitStep1: string;
      submitStep2: string;
      submitStep3: string;
      createSectionTitle: string;
      createStep1: string;
      createStep2: string;
      createStep3: string;
      joinSectionTitle: string;
      joinStep1: string;
      joinStep2: string;
      joinStep3: string;
      dismissButton: string;
    };
    formTitle: string;
    instructionsTitle: string;
    instruction1: string;
    instruction2: string;
    instruction3: string;
    closedInputPlaceholder: string;
    openInputPlaceholder: string;
    closedSubmitButton: string;
    submitButton: string;
  };
  tournaments: Record<string, string>;
  manage: Record<string, string>;
  stats: Record<string, string>;
  account: Record<string, string>;
  tournamentDetail: Record<string, string>;
  draftTournament: Record<string, string>;
  tournamentChat: Record<string, string>;
}

export const copy = buildCopy(copyEntries) as unknown as CopySchema;

export type CopyKey = keyof typeof copyEntries;
