'use client';

import {useCallback, useEffect, useState} from 'react';
import {collection, doc, getDocs, query, where} from 'firebase/firestore';
import {getFirestoreInstance} from '@zerebro/shared-firebase';
import type {FeeRow} from '@/components/FeeTable';

function mapFee(id: string, data: Record<string, unknown>): FeeRow {
  return {
    id,
    className: String(data.className ?? ''),
    name: String(data.name ?? ''),
    rollNo: String(data.rollNo ?? ''),
    month: String(data.month ?? ''),
    amountDue: typeof data.amountDue === 'number' ? data.amountDue : 0,
    amountPaid: typeof data.amountPaid === 'number' ? data.amountPaid : 0,
    balance: typeof data.balance === 'number' ? data.balance : 0,
    pending: data.pending === true,
    grade: typeof data.grade === 'number' ? data.grade : 99,
    section: typeof data.section === 'string' ? data.section : '',
  };
}

export function useMonthFees(schoolId: string, month: string, pendingOnly: boolean) {
  const [rows, setRows] = useState<FeeRow[] | null>(null);

  const load = useCallback(async () => {
    const fees = collection(doc(getFirestoreInstance(), 'schools', schoolId), 'fees');
    const snap = await getDocs(query(
      fees,
      where('month', '==', month),
      ...(pendingOnly ? [where('pending', '==', true)] : []),
    ));
    setRows(snap.docs.map(item => mapFee(item.id, item.data())));
  }, [month, pendingOnly, schoolId]);

  useEffect(() => { void load(); }, [load]);
  return {rows, load};
}
