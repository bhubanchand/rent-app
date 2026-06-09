export function createDummyClient(reason: string) {
  console.warn(`[Supabase Dummy Client] Active. Reason: ${reason}`);

  // Safe chainable thenable creator
  const createThenable = (value: any) => {
    const thenable: any = {
      then(onfulfilled: any) {
        return Promise.resolve(value).then(onfulfilled);
      },
      catch(onrejected: any) {
        return Promise.resolve(value).catch(onrejected);
      },
      finally(onfinally: any) {
        return Promise.resolve(value).finally(onfinally);
      }
    };

    return new Proxy(thenable, {
      get(target, prop) {
        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
          return target[prop];
        }
        // Chain builder methods (e.g. .eq(), .limit(), .order()) back to the thenable
        return () => createThenable(value);
      }
    });
  };

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
            return () => Promise.resolve({ 
              data: {}, 
              error: { message: `Supabase client not initialized: ${reason}` } 
            });
          }
        });
      }
      if (prop === 'from') {
        return () => ({
          select: () => createThenable({ data: [], error: null }),
          insert: () => createThenable({ data: null, error: { message: `Supabase client not initialized: ${reason}` } }),
          update: () => createThenable({ data: null, error: { message: `Supabase client not initialized: ${reason}` } }),
          delete: () => createThenable({ data: null, error: { message: `Supabase client not initialized: ${reason}` } })
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
