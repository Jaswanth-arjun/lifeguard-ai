import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function ConnectionManager() {
  const [connections, setConnections] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [patientRecord, setPatientRecord] = useState(null);
  
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      
      const patientProfileId = session.user.id;

      // Get the patients.id first
      const { data: patientData, error: patientErr } = await supabase
        .from('patients')
        .select('id')
        .eq('profile_id', patientProfileId)
        .single();
        
      if (patientErr || !patientData) {
        setLoading(false);
        return;
      }
      
      setPatientRecord(patientData);
      const pid = patientData.id;

      // Fetch Family Links
      const { data: familyLinks } = await supabase
        .from('family_patient_links')
        .select('id, profiles!family_profile_id(name, role)')
        .eq('patient_id', pid);

      // Fetch Doctor Links
      const { data: doctorLinks } = await supabase
        .from('doctor_patient_links')
        .select('id, profiles!doctor_profile_id(name, role)')
        .eq('patient_id', pid);

      // Combine links
      const allConns = [
        ...(familyLinks || []).map(l => ({ ...l, type: 'family', profile: l.profiles })),
        ...(doctorLinks || []).map(l => ({ ...l, type: 'doctor', profile: l.profiles }))
      ];
      setConnections(allConns);

      // Fetch all eligible users to link (family & doctors)
      const { data: otherUsers } = await supabase
        .from('profiles')
        .select('id, name, role')
        .in('role', ['family', 'doctor']);
        
      setAvailableUsers(otherUsers || []);
      setLoading(false);
    }
    
    loadData();
  }, [patientProfileId]);

  const handleLinkUser = async (userId, role) => {
    if (!patientRecord) return;
    
    try {
      if (role === 'family') {
        await supabase.from('family_patient_links').insert([{
           family_profile_id: userId,
           patient_id: patientRecord.id,
           relationship: 'Family Member'
        }]);
      } else if (role === 'doctor') {
        await supabase.from('doctor_patient_links').insert([{
           doctor_profile_id: userId,
           patient_id: patientRecord.id
        }]);
      }
      alert('Successfully linked user!');
      // Simple reload to refresh list
      window.location.reload();
    } catch (e) {
      alert('Error linking user: ' + e.message);
    }
  };

  const handleRemoveLink = async (id, type) => {
    try {
      if (type === 'family') {
        await supabase.from('family_patient_links').delete().eq('id', id);
      } else {
        await supabase.from('doctor_patient_links').delete().eq('id', id);
      }
      setConnections(c => c.filter(x => x.id !== id));
    } catch (e) {
      alert("Error removing link.");
    }
  };

  if (loading) return <div className="card">Loading connections...</div>;

  // Filter out already linked users
  const linkedProfileIds = connections.map(c => c.profile?.id);
  const unlinkedAvailable = availableUsers.filter(u => !linkedProfileIds.includes(u.id));

  return (
    <div className="card">
      <div className="section-header">
        <span className="icon">🔗</span>
        Manage Permissions
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
        Control who can view your live vitals and receive emergency alerts.
      </p>

      {connections.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1rem' }}>
          {connections.map(c => (
            <li key={c.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px', marginBottom: '0.5rem' }}>
              <div>
                <strong>{c.profile?.name}</strong> <span style={{ fontSize: '0.75rem', color: 'var(--neon-cyan)' }}>({c.type})</span>
              </div>
              <button 
                onClick={() => handleRemoveLink(c.id, c.type)} 
                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: '0.85rem', color: 'var(--warn)', marginBottom: '1rem' }}>No connections linked yet!</p>
      )}

      <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
        <strong style={{ fontSize: '0.85rem', color: 'var(--text-bright)' }}>Add Connection</strong>
        {unlinkedAvailable.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.5rem' }}>
            {unlinkedAvailable.map(u => (
              <li key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.85rem' }}>{u.name} ({u.role})</div>
                <button 
                   type="button" 
                   onClick={() => handleLinkUser(u.id, u.role)}
                   style={{ background: 'var(--neon-cyan)', color: 'black', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  Authorize
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.5rem' }}>No other users available to link.</p>
        )}
      </div>
    </div>
  );
}
