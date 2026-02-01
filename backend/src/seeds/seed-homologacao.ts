/**
 * Seed de Homologação - MockMail.dev
 * 
 * Este script cria dados iniciais para o ambiente de homologação,
 * incluindo um usuário administrador para testes.
 * 
 * Uso: npm run seed:homologacao
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

// Importar modelos
import User, { IUser, ROLE_PERMISSIONS } from '../models/User';
import EmailBox from '../models/EmailBox';

// Configuração do seed
const SEED_CONFIG = {
  adminUser: {
    email: 'admin@mockmail.dev',
    password: 'Admin@2024!',
    name: 'Administrador MockMail',
    role: 'admin' as const,
  },
  testUser: {
    email: 'teste@mockmail.dev',
    password: 'Teste@2024!',
    name: 'Usuário de Teste',
    role: 'user' as const,
  },
  testEmailBoxes: [
    {
      address: 'demo',
      domain: 'mockmail.dev',
      description: 'Caixa de demonstração',
    },
    {
      address: 'test',
      domain: 'mockmail.dev',
      description: 'Caixa de testes',
    },
  ],
};

async function connectToMongoDB(): Promise<void> {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mockmail';
  
  console.log('📡 Conectando ao MongoDB...');
  
  await mongoose.connect(mongoUri, {
    autoIndex: true,
  });
  
  console.log('✅ Conectado ao MongoDB com sucesso!');
}

async function createUser(userData: typeof SEED_CONFIG.adminUser): Promise<IUser> {
  // Verificar se usuário já existe
  const existingUser = await User.findOne({ email: userData.email });
  
  if (existingUser) {
    console.log(`⚠️  Usuário ${userData.email} já existe, atualizando...`);
    
    // Atualizar senha e dados
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    existingUser.password = hashedPassword;
    existingUser.name = userData.name;
    existingUser.role = userData.role;
    existingUser.isActive = true;
    existingUser.permissions = ROLE_PERMISSIONS[userData.role];
    
    await existingUser.save();
    return existingUser;
  }
  
  // Criar novo usuário
  const hashedPassword = await bcrypt.hash(userData.password, 10);
  
  const user = new User({
    email: userData.email,
    password: hashedPassword,
    name: userData.name,
    role: userData.role,
    isActive: true,
    permissions: ROLE_PERMISSIONS[userData.role],
  });
  
  await user.save();
  console.log(`✅ Usuário ${userData.email} criado com sucesso!`);
  
  return user;
}

async function createEmailBox(boxData: typeof SEED_CONFIG.testEmailBoxes[0], userId: mongoose.Types.ObjectId): Promise<void> {
  const fullAddress = `${boxData.address}@${boxData.domain}`;
  
  // Verificar se já existe
  const existingBox = await EmailBox.findOne({ address: boxData.address, domain: boxData.domain });
  
  if (existingBox) {
    console.log(`⚠️  EmailBox ${fullAddress} já existe, pulando...`);
    return;
  }
  
  const emailBox = new EmailBox({
    address: boxData.address,
    domain: boxData.domain,
    description: boxData.description,
    userId: userId,
    isActive: true,
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano
  });
  
  await emailBox.save();
  console.log(`✅ EmailBox ${fullAddress} criada com sucesso!`);
}

async function runSeed(): Promise<void> {
  console.log('\n🌱 ═══════════════════════════════════════════════════════════');
  console.log('   SEED DE HOMOLOGAÇÃO - MockMail.dev');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  try {
    // Conectar ao MongoDB
    await connectToMongoDB();
    
    // Criar usuário administrador
    console.log('\n📦 Criando usuário administrador...');
    const adminUser = await createUser(SEED_CONFIG.adminUser);
    
    // Criar usuário de teste
    console.log('\n📦 Criando usuário de teste...');
    const testUser = await createUser(SEED_CONFIG.testUser);
    
    // Criar caixas de email de teste
    console.log('\n📦 Criando caixas de email...');
    for (const boxData of SEED_CONFIG.testEmailBoxes) {
      await createEmailBox(boxData, adminUser._id as mongoose.Types.ObjectId);
    }
    
    // Resumo
    console.log('\n✅ ═══════════════════════════════════════════════════════════');
    console.log('   SEED CONCLUÍDO COM SUCESSO!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n📋 Credenciais de Acesso:\n');
    console.log('   👤 ADMINISTRADOR:');
    console.log(`      Email: ${SEED_CONFIG.adminUser.email}`);
    console.log(`      Senha: ${SEED_CONFIG.adminUser.password}`);
    console.log(`      Role: ${SEED_CONFIG.adminUser.role}`);
    console.log('\n   👤 USUÁRIO DE TESTE:');
    console.log(`      Email: ${SEED_CONFIG.testUser.email}`);
    console.log(`      Senha: ${SEED_CONFIG.testUser.password}`);
    console.log(`      Role: ${SEED_CONFIG.testUser.role}`);
    console.log('\n   📧 CAIXAS DE EMAIL:');
    for (const box of SEED_CONFIG.testEmailBoxes) {
      console.log(`      - ${box.address}@${box.domain}`);
    }
    console.log('\n═══════════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ Erro durante o seed:', error);
    process.exit(1);
  } finally {
    // Fechar conexão
    await mongoose.connection.close();
    console.log('🔌 Conexão com MongoDB fechada.');
  }
}

// Executar seed
runSeed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
