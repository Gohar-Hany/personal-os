const { createClient } = require('@libsql/client');
const client = createClient({ url: 'file:prisma/dev.db' });

async function main() {
  try {
    await client.execute('UPDATE "Transaction" SET projectId = NULL WHERE projectId IS NOT NULL');
  } catch(e) {
    console.log('No transactions updated or error:', e.message);
  }

  const delMilestones = await client.execute('DELETE FROM Milestone');
  console.log('Deleted milestones count:', delMilestones.rowsAffected);

  const delProjects = await client.execute('DELETE FROM Project');
  console.log('Deleted projects count:', delProjects.rowsAffected);

  const pCount = await client.execute('SELECT count(*) as c FROM Project');
  console.log('Remaining projects:', pCount.rows[0].c);

  const mCount = await client.execute('SELECT count(*) as c FROM Milestone');
  console.log('Remaining milestones:', mCount.rows[0].c);
}

main().catch(console.error);
