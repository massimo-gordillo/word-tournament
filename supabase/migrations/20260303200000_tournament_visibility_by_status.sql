/*
  # Tournament visibility by status

  - Draft: visible only to creator (created_by = auth.uid())
  - Cancelled: not visible to anyone
  - Active/Closed: visible to creator or participants via can_access_tournament
*/

DROP POLICY IF EXISTS "Users can read accessible tournaments" ON tournaments;

CREATE POLICY "Users can read accessible tournaments"
  ON tournaments
  FOR SELECT
  TO authenticated
  USING (
    (status = 'draft' AND created_by = auth.uid())
    OR (status IN ('active', 'closed') AND can_access_tournament(id, auth.uid()))
  );
