# 📚 mockmail.dev

**mockmail.dev** é um micro SaaS que fornece caixas de e-mail temporárias e interativas. O objetivo principal do projeto é gerar e-mails randômicos exclusivos para cada usuário, permitindo que eles recebam, visualizem, respondam e encaminhem mensagens diretamente de uma interface frontend conectada a um backend escalável.

## 🚀 Funcionalidades do MVP

- ✅ Geração de endereços de e-mail randômicos atrelados a cada usuário.
- ✅ Recebimento de e-mails diretamente no backend através de um webhook.
- ✅ Armazenamento dos e-mails recebidos no MongoDB.
- ✅ Interface frontend para exibição dos e-mails recebidos.
- ✅ Envio de e-mails utilizando o domínio `@mockmail.dev` através do serviço ForwardEmail.net.
- ✅ Suporte a políticas de segurança de e-mail (DKIM, DMARC, Return-Path).

## 🏗️ Estrutura do Projeto

```
/mockmail.dev
│
├── /backend
│   ├── /src
│   │   ├── /controllers
│   │   ├── /services
│   │   ├── /routes
│   │   ├── /models
│   │   └── /config
│   ├── server.ts
│   └── .env
│
├── /frontend
│   └── /pages
│       ├── index.tsx
│       ├── inbox.tsx
│       └── login.tsx
│
└── docker-compose.yml
```

## 🧰 Tecnologias Utilizadas

### Backend:

- **Node.js**
- **Express**
- **TypeScript**
- **MongoDB (via Mongoose)**
- **ForwardEmail.net (Webhook e SMTP)**
- **Nodemailer**
- **Winston (Logs)**

### Frontend:

- **Next.js**
- **React**
- **Tailwind CSS**

## ⚙️ Configuração Inicial

1. Clone o repositório:

   ```bash
   git clone https://github.com/seu-usuario/mockmail.dev.git
   cd mockmail.dev
   ```

2. Instale as dependências:

   ```bash
   cd backend
   npm install
   ```

3. Configure as variáveis de ambiente no arquivo `.env`:

   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/mockmail?retryWrites=true&w=majority
   SMTP_HOST=smtp.forwardemail.net
   SMTP_USER=your_email@example.com
   SMTP_PASS=your_password
   ```

4. Execute o backend:

   ```bash
   npm run dev
   ```

5. Execute o frontend:
   ```bash
   cd frontend
   npm run dev
   ```

## 🧪 Testes

- Utilize o **Postman** ou **Insomnia** para testar o webhook de recebimento de e-mails no endpoint `/api/emails/incoming`.
- Utilize o endpoint `/api/emails/send` para testar o envio de e-mails via SMTP.

## 📝 Roadmap Futuro

- [ ] Suporte a anexos nos e-mails.
- [ ] Autenticação de usuários.
- [ ] Painel administrativo.
- [ ] Suporte a múltiplos domínios.
- [ ] Funcionalidades freemium para monetização.
