/*
  # Draft tournaments visible to participants

  Allow participants (not only creator) to read draft tournaments they have joined.
  Cancelled remains invisible to everyone.
*/

DROP POLICY IF EXISTS "Users can read accessible tournaments" ON tournaments;

CREATE POLICY "Users can read accessible tournaments"
  ON tournaments
  FOR SELECT
  TO authenticated
  USING (
    status IN ('draft', 'active', 'closed')
    AND can_access_tournament(id, auth.uid())
  );
