-- A block from the last week may still be open, answered or re-read, so it keeps the option order its questions were shown in.
UPDATE study_session_blocks AS block
SET payload = block.payload || '{"storedOptionOrder": true}'::jsonb
FROM study_sessions AS session
WHERE session.id = block.session_id
  AND session.local_date >= CURRENT_DATE - 7
  AND jsonb_typeof(block.payload) = 'object';
