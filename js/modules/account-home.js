import { homeStorageScope, exportMyHomeProfile, importMyHomeProfile } from './my-home-store.js?v=private-home-2';

// Explicit transfers protect existing device records; stale cloud writes fail.
export function bindAccountHome(client, user, message) {
  let revision = null;
  const save = document.getElementById('cloudSave');
  const load = document.getElementById('cloudLoad');
  const download = document.getElementById('cloudDownload');
  async function current() {
    const { data: identity, error: authError } = await client.auth.getUser();
    if (authError || identity.user?.id !== user.id) throw new Error('Your account changed. Reload this page before transferring records.');
    const { data, error } = await client.from('home_profiles').select('profile,revision,updated_at').eq('user_id',user.id).maybeSingle();
    if (homeStorageScope() !== 'member:' + user.id) throw new Error('Account changed. Reload before transferring records.');
    if (error) throw new Error('Could not read your cloud record. Your local records are unchanged.');
    return data;
  }
  function backup(text) {
    const url = URL.createObjectURL(new Blob([text], {type:'application/json'}));
    const a = document.createElement('a'); a.href=url; a.download='atoz-my-home-backup.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  save.onclick = async () => {
    save.disabled = true;
    try {
      const record = await current();
      // First transfer requires reviewing the existing cloud copy before replacing it.
      if (revision === null && record) {
        revision = record.revision;
        message('A cloud record already exists. Download it or load it on this device before choosing to replace it.');
        return;
      }
      if (!confirm(`Save this device’s My Home records to ${user.email}? This replaces the account’s current cloud copy.`)) return;
      const profile = JSON.parse(exportMyHomeProfile());
      const { data, error } = await client.rpc('save_home_profile',{new_profile:profile,expected_revision:revision ?? 0,expected_user_id:user.id});
      if (error) throw new Error('Cloud save failed. Your local records are unchanged.');
      if (!data?.length) throw new Error('Another device changed the cloud record. Reload or download that copy before saving.');
      revision = data[0].revision;
      message('Saved to your private cloud record. On another device, sign in and choose Load cloud copy.');
    } catch(error) { message(error.message); }
    finally { save.disabled=false; }
  };
  load.onclick = async () => {
    load.disabled=true;
    try {
      const record=await current();
      if (!record) { message('No cloud record yet. Save a copy from the device with your home records.'); return; }
      if (!confirm('Load your cloud copy? A backup of this device’s current records will download before they are replaced.')) return;
      backup(exportMyHomeProfile());
      const result=importMyHomeProfile(JSON.stringify(record.profile));
      if (!result.ok) throw new Error(result.error);
      const persisted=JSON.parse(exportMyHomeProfile()); delete persisted.exportedAt;
      if (JSON.stringify(persisted)!==JSON.stringify(result.profile)) throw new Error('This browser could not save the cloud copy locally. Keep your downloaded backup and allow browser storage.');
      revision=record.revision;
      message('Cloud copy loaded on this device. Open My Home to view it. Keep the downloaded backup.');
    } catch(error) { message(error.message); }
    finally { load.disabled=false; }
  };
  download.onclick = async () => {
    try { const record=await current(); if(!record) throw new Error('No cloud record yet.'); backup(JSON.stringify(record.profile,null,2)); message('Cloud backup downloaded.'); }
    catch(error) { message(error.message); }
  };
}
