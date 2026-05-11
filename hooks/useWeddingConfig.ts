import { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { configFromDoc } from '../lib/weddingConfig';
import { onSnapshotError } from '../lib/firestore';
import { useWeddingStore } from '../store/weddingStore';

export function useWeddingConfig(weddingId: string | null) {
  const { setConfig, setLoading } = useWeddingStore();

  useEffect(() => {
    if (!weddingId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(doc(db, 'weddings', weddingId), (snap) => {
      if (snap.exists()) {
        setConfig(configFromDoc({ weddingId, ...snap.data() }));
      } else {
        setConfig(null);
      }
      setLoading(false);
    }, onSnapshotError);
    return unsub;
  }, [weddingId]);
}
