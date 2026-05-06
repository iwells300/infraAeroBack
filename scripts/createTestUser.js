import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.usuario.create({
    data: {
      nombre: 'Tester',
      email: 'test@example.com'
    }
  });
  console.log('Usuario creado:', user);
}

main().catch(console.error).finally(() => prisma.$disconnect());
