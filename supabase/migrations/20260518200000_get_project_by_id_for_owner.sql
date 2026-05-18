-- Full project row for owner dashboard edit/update when direct SELECT is blocked.

CREATE OR REPLACE FUNCTION public.get_project_by_id_for_owner(p_project_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(p)
  FROM public.projects p
  WHERE p.id = p_project_id
    AND p.user_id::text = auth.uid()::text
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_project_by_id_for_owner(uuid) IS
  'Returns full project row for the authenticated owner (dashboard edit/update).';

GRANT EXECUTE ON FUNCTION public.get_project_by_id_for_owner(uuid) TO authenticated;
