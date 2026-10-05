/** Desktop-agent build: the local launcher sets this for the web process. Otherwise this is the public marketing site. */
export const isLocalAgent = (): boolean => !!process.env.APPFORGE_LOCAL_KEY;
