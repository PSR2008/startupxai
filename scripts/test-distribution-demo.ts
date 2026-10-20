process.env.LAUNCHGATE_DISTRIBUTION_DEMO = '1';
void import('./test-product-ui').catch(error => { console.error(error); process.exitCode = 1; });
