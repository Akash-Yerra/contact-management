import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/supabase';
import { useAuth } from './AuthContext';

type Contact = {
  id: string;
  full_name: string;
  phone_number: string;
  address?: string;
  occupation_1?: string;
  occupation_2?: string;
  occupation_3?: string;
  occupation_4?: string;
  expected_wage?: string;
  work_experience?: string;
  daily_wage?: string;
  user_id: string;
  created_at?: string;
  updated_at?: string;
};

type ContactsContextType = {
  contacts: Contact[];
  refreshContacts: () => Promise<void>;
  isLoading: boolean;
};

const ContactsContext = createContext<ContactsContextType | undefined>(undefined);

export function ContactsProvider({ children }: { children: React.ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user: authUser } = useAuth();

  const refreshContacts = useCallback(async () => {
    if (!authUser?.id) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', authUser.id)
        .order('full_name');

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [authUser?.id]);

  // Add real-time subscription
  useEffect(() => {
    if (!authUser?.id) return;

    const subscription = supabase
      .channel('contacts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `user_id=eq.${authUser.id}`
        },
        () => {
          refreshContacts();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [authUser?.id, refreshContacts]);

  // Initial load
  useEffect(() => {
    refreshContacts();
  }, [refreshContacts]);

  return (
    <ContactsContext.Provider value={{ contacts, refreshContacts, isLoading }}>
      {children}
    </ContactsContext.Provider>
  );
}

export function useContacts() {
  const context = useContext(ContactsContext);
  if (context === undefined) {
    throw new Error('useContacts must be used within a ContactsProvider');
  }
  return context;
} 