-- Create a function that automatically creates a profile and patient row upon user sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, role, name)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'role',
    new.raw_user_meta_data->>'name'
  );

  -- If they are a patient, also insert into the patients table
  IF new.raw_user_meta_data->>'role' = 'patient' THEN
    INSERT INTO public.patients (profile_id)
    VALUES (new.id);
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger that runs the function every time a new user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
