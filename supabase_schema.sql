-- ==========================================
-- 1. TABLE DEFINITIONS (Dependencies first)
-- ==========================================

CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('patient', 'family', 'doctor', 'admin')),
  name TEXT NOT NULL,
  phone TEXT,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  date_of_birth DATE,
  blood_group TEXT,
  conditions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE family_patient_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  relationship TEXT,
  permission_level TEXT DEFAULT 'view_only',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_profile_id, patient_id)
);

CREATE TABLE doctor_patient_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(doctor_profile_id, patient_id)
);

CREATE TABLE vitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  heart_rate INTEGER,
  spo2 INTEGER,
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  temperature NUMERIC,
  risk_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  lat NUMERIC,
  lng NUMERIC,
  accuracy NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE emergency_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  triggered_by TEXT,
  severity TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID REFERENCES emergency_alerts(id) ON DELETE CASCADE,
  recipient_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  channel TEXT,
  delivery_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ==========================================
-- 2. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Patients
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients can read own record" ON patients
  FOR SELECT USING (
    profile_id = auth.uid() OR
    EXISTS (SELECT 1 FROM doctor_patient_links WHERE patient_id = patients.id AND doctor_profile_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM family_patient_links WHERE patient_id = patients.id AND family_profile_id = auth.uid())
  );
CREATE POLICY "Patients can update own record" ON patients FOR UPDATE USING (profile_id = auth.uid());

-- Family Links
ALTER TABLE family_patient_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family can see their links" ON family_patient_links
  FOR SELECT USING (
    family_profile_id = auth.uid() OR 
    EXISTS(SELECT 1 FROM patients WHERE patients.id = patient_id AND patients.profile_id = auth.uid())
  );

-- Doctor Links
ALTER TABLE doctor_patient_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doctors can see their links" ON doctor_patient_links
  FOR SELECT USING (
    doctor_profile_id = auth.uid() OR 
    EXISTS(SELECT 1 FROM patients WHERE patients.id = patient_id AND patients.profile_id = auth.uid())
  );

-- Vitals
ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients can insert their vitals" ON vitals
  FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM patients WHERE patients.id = patient_id AND patients.profile_id = auth.uid()));
CREATE POLICY "Read vitals policy" ON vitals
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM patients WHERE patients.id = patient_id AND patients.profile_id = auth.uid()) OR
    EXISTS(SELECT 1 FROM family_patient_links WHERE family_patient_links.patient_id = vitals.patient_id AND family_profile_id = auth.uid()) OR
    EXISTS(SELECT 1 FROM doctor_patient_links WHERE doctor_patient_links.patient_id = vitals.patient_id AND doctor_profile_id = auth.uid())
  );

-- Locations
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients can insert location" ON locations
  FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM patients WHERE patients.id = patient_id AND patients.profile_id = auth.uid()));
CREATE POLICY "Read locations policy" ON locations
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM patients WHERE patients.id = patient_id AND patients.profile_id = auth.uid()) OR
    EXISTS(SELECT 1 FROM family_patient_links WHERE family_patient_links.patient_id = locations.patient_id AND family_profile_id = auth.uid()) OR
    EXISTS(SELECT 1 FROM doctor_patient_links WHERE doctor_patient_links.patient_id = locations.patient_id AND doctor_profile_id = auth.uid())
  );

-- Emergency Alerts
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read alerts policy" ON emergency_alerts
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM patients WHERE patients.id = patient_id AND patients.profile_id = auth.uid()) OR
    EXISTS(SELECT 1 FROM family_patient_links WHERE family_patient_links.patient_id = emergency_alerts.patient_id AND family_profile_id = auth.uid()) OR
    EXISTS(SELECT 1 FROM doctor_patient_links WHERE doctor_patient_links.patient_id = emergency_alerts.patient_id AND doctor_profile_id = auth.uid())
  );
CREATE POLICY "Patients can insert SOS alert" ON emergency_alerts
  FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM patients WHERE patients.id = patient_id AND patients.profile_id = auth.uid()));

-- Notification Logs
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON notification_logs
  FOR SELECT USING (recipient_profile_id = auth.uid());


-- ==========================================
-- 3. REALTIME SETUP
-- ==========================================
-- Ensure realtime events fire for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE vitals;
ALTER PUBLICATION supabase_realtime ADD TABLE locations;
ALTER PUBLICATION supabase_realtime ADD TABLE emergency_alerts;
