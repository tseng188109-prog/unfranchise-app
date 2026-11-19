const sent=[]; globalThis.__sent=sent
export default { setVapidDetails(){}, async sendNotification(sub,payload){ if(sub.endpoint.includes('gone')){const e=new Error('gone');e.statusCode=410;throw e} if(sub.endpoint.includes('boom')){const e=new Error('boom');e.statusCode=500;throw e} sent.push([sub.endpoint,JSON.parse(payload)]) } }
