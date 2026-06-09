export function createDummyClient(reason: string) {
  console.warn(`[Supabase Dummy Client] Active. Reason: ${reason}`);
  const dummy: any = new Proxy(() => {}, {
    get(target, prop) {
      if (prop === 'auth') {
        return new Proxy({}, {
          get(target, authProp) {
            if (authProp === 'getUser') {
              return () => Promise.resolve({ data: { user: null }, error: null });
            }
            if (authProp === 'getSession') {
              return () => Promise.resolve({ data: { session: null }, error: null });
            }
            if (authProp === 'signOut') {
              return () => Promise.resolve({ error: null });
            }
            if (authProp === 'onAuthStateChange') {
              return () => ({ data: { subscription: { unsubscribe: () => {} } } });
            }
            if (authProp === 'mfa') {
              return {
                getAuthenticatorAssuranceLevel: () => Promise.resolve({ 
                  data: { currentLevel: 'aal1', nextLevel: 'aal1' }, 
                  error: null 
                }),
                listFactors: () => Promise.resolve({ 
                  data: { all: [], totp: [] }, 
                  error: null 
                }),
                challenge: () => Promise.resolve({ 
                  data: { id: 'dummy-challenge-id' }, 
                  error: null 
                }),
                verify: () => Promise.resolve({ 
                  data: {}, 
                  error: null 
                })
              };
            }
            // default fallback for other auth methods
            return () => Promise.resolve({ 
              data: {}, 
              error: { message: `Supabase client not initialized: ${reason}` } 
            });
          }
        });
      }
      if (prop === 'from') {
        return () => ({
          select: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null })
            }),
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
              limit: () => Promise.resolve({ data: [], error: null })
            })
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ 
                data: null, 
                error: { message: `Supabase client not initialized: ${reason}` } 
              })
            }),
            single: () => Promise.resolve({ 
              data: null, 
              error: { message: `Supabase client not initialized: ${reason}` } 
            })
          }),
          update: () => ({
            eq: () => Promise.resolve({ 
              data: null, 
              error: { message: `Supabase client not initialized: ${reason}` } 
            })
          }),
          delete: () => ({
            eq: () => Promise.resolve({ 
              data: null, 
              error: { message: `Supabase client not initialized: ${reason}` } 
            })
          })
        });
      }
      return dummy;
    },
    apply() {
      return dummy;
    }
  });
  return dummy;
}
