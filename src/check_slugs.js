const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.hotel.findMany().then(h => {
  console.log(JSON.stringify(h.map(x => ({name: x.name, slug: x.slug})), null, 2));
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
