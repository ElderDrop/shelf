-- Shelf domain RLS policies (F-01 Phase 2)
-- Enforces approved-only catalog visibility, admin catalog management, and assignment isolation.

-- profiles: read own row (admins can read all via is_admin)
CREATE POLICY profiles_select_authenticated
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- profiles: self-update only; role changes blocked (admins promote via service role / SQL in S-01)
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (
      SELECT p.role
      FROM public.profiles AS p
      WHERE p.id = auth.uid()
    )
  );

-- catalog_items: regular users see approved items only; admins see and manage all
CREATE POLICY catalog_items_select_authenticated
  ON public.catalog_items
  FOR SELECT
  TO authenticated
  USING (status = 'approved' OR public.is_admin());

CREATE POLICY catalog_items_insert_admin
  ON public.catalog_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY catalog_items_update_admin
  ON public.catalog_items
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY catalog_items_delete_admin
  ON public.catalog_items
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- user_assignments: users manage only their own rows
CREATE POLICY user_assignments_select_own
  ON public.user_assignments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_assignments_insert_own_approved
  ON public.user_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.catalog_items AS ci
      WHERE ci.id = catalog_item_id
        AND ci.status = 'approved'
    )
  );

CREATE POLICY user_assignments_update_own
  ON public.user_assignments
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.catalog_items AS ci
      WHERE ci.id = catalog_item_id
        AND ci.status = 'approved'
    )
  );

CREATE POLICY user_assignments_delete_own
  ON public.user_assignments
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- catalog_item_id is immutable after insert (users may only change list_type)
CREATE OR REPLACE FUNCTION public.prevent_assignment_catalog_item_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.catalog_item_id IS DISTINCT FROM OLD.catalog_item_id THEN
    RAISE EXCEPTION 'catalog_item_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_assignments_prevent_catalog_item_change
  BEFORE UPDATE ON public.user_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_assignment_catalog_item_change();
