# Maggenta Site Admin - Backend

Backend administrativo para gerenciamento de produtos, orçamentos e usuários.

## Tecnologias

- **Runtime**: Node.js
- **Framework**: Express.js
- **Banco de Dados**: MySQL 2
- **Linguagem**: TypeScript
- **Autenticação**: JWT
- **Validação**: Joi
- **Segurança**: Helmet, CORS

## Arquitetura em Camadas

```
src/
├── database/        - Conexão com MySQL
├── models/          - Acesso a dados (DAL)
├── services/        - Lógica de negócio
├── controllers/     - Handlers de requisições HTTP
├── routes/          - Definição de rotas
├── middleware/      - Middlewares (auth, validação, erro)
├── types/           - Tipos TypeScript
├── utils/           - Helpers e utilitários
└── config/          - Configurações
```

## Instalação

```bash
cd backend
npm install
```

## Configuração

Copie `.env.example` para `.env` e atualize as variáveis:

```bash
cp .env.example .env
```

## Desenvolvimento

```bash
npm run dev
```

## Build

```bash
npm run build
npm start
```

## Endpoints

### Autenticação (Usuários)

- `POST /api/v1/usuarios/register` - Registrar novo usuário
- `POST /api/v1/usuarios/login` - Login
- `GET /api/v1/usuarios/profile` - Perfil do usuário autenticado
- `GET /api/v1/usuarios` - Listar usuários
- `GET /api/v1/usuarios/:id` - Obter usuário por ID
- `PUT /api/v1/usuarios/:id` - Atualizar usuário
- `DELETE /api/v1/usuarios/:id` - Deletar usuário

### Produtos

- `POST /api/v1/produtos` - Criar produto
- `GET /api/v1/produtos` - Listar produtos
- `GET /api/v1/produtos/:id` - Obter produto por ID
- `PUT /api/v1/produtos/:id` - Atualizar produto
- `DELETE /api/v1/produtos/:id` - Deletar produto

### Orçamentos

- `POST /api/v1/orcamentos` - Criar orçamento
- `GET /api/v1/orcamentos` - Listar orçamentos
- `GET /api/v1/orcamentos/:id` - Obter orçamento por ID
- `PUT /api/v1/orcamentos/:id` - Atualizar orçamento
- `DELETE /api/v1/orcamentos/:id` - Deletar orçamento
- `POST /api/v1/orcamentos/:id/itens` - Adicionar item ao orçamento
- `DELETE /api/v1/orcamentos/itens/:itemId` - Remover item do orçamento

## Resposta Padrão

```json
{
  "success": true,
  "message": "Success message",
  "data": {},
  "timestamp": "2026-04-24T10:30:00.000Z"
}
```

## Autenticação

Inclua o token JWT no header:

```
Authorization: Bearer <token>
```

## Validação

Todos os inputs são validados com Joi. Erros de validação retornam:

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "email",
        "message": "must be a valid email"
      }
    ]
  },
  "timestamp": "2026-04-24T10:30:00.000Z"
}
```

## Segurança

- Senhas com bcrypt (salt 10)
- JWT para autenticação
- CORS configurado
- Headers de segurança com Helmet
- Validação de input com Joi
- SQL Injection prevention (prepared statements)
- Isolamento por empresa (multi-tenant)

## Performance

- Connection pooling do MySQL2
- Queries otimizadas com índices
- Paginação em listas
- Busca com LIKE eficiente
