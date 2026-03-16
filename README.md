# AdsDash Cloud 📈

![AdsDash Overview](https://img.shields.io/badge/Status-Concluído-success)
![Vanilla JS](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript)
![Firebase](https://img.shields.io/badge/Firebase-Auth_&_Firestore-FFCA28?logo=firebase)

Uma dashboard moderna e elegante desenvolvida para a gestão e acompanhamento de campanhas de tráfego pago (como Facebook Ads). Criada com o objetivo de substituir planilhas tradicionais (como o Excel) por uma interface visual imersiva, focada na clareza dos dados e métricas reais de performance.

Esta aplicação foi evoluída para uma arquitetura **Cloud-Native**, contando com autenticação de múltiplos usuários e persistência de banco de dados na nuvem via Firebase.

---

## ✨ Principais Funcionalidades

- **🗂️ Gestão de Múltiplas Campanhas:** Crie, edite e acompanhe pastas individuais para cada campanha de anúncios.
- **📅 Registros Diários (CRUD):** Lance dados financeiros dia a dia dentro de cada campanha (Valor Gasto, Quantidade de Vendas e Faturamento Total).
- **📊 Automação de Métricas (ROAS e Lucro):** A plataforma calcula automaticamente o ROAS (Retorno sobre Investimento) diário e geral, e condensa o seu Lucro Mensal Líquido na tela inicial.
- **🔐 Autenticação de Usuários:** Sistema de Login e Registro via Email/Senha (Firebase Auth). Cada usuário visualiza unicamente o seu próprio painel e dados isolados.
- **☁️ Banco de Dados em Tempo Real:** Armazenamento escalável e seguro usando o Firestore Database, mantendo todos os seus dados preservados independente da máquina ou navegador que você usa.
- **📈 Gráficos Interativos:** Visualização da "Evolução Diária" (Faturamento vs. Gasto) em formato de linha, e "ROAS por Dia" em gráfico de barras para análises rápidas de performance.
- **🎨 Design Premium (Dark Theme):** Interface construída artesanalmente do zero com HTML/CSS Vanilla, utilizando Glassmorphism, tipografia moderna (Inter), gradientes polidos e micro-interações responsivas. Nenhum framework CSS pesado foi utilizado.

---

## 🛠️ Tecnologias Utilizadas

**Frontend:**
* HTML5 (Semântico)
* CSS3 (Flexbox/Grid, Variáveis Nativas, Glassmorphism, Design Responsivo)
* JavaScript Vanila (Modules, Assincronismo/Promises, Manipulação de DOM)

**Backend as a Service (BaaS) - Integração:**
* [Firebase Authentication](https://firebase.google.com/docs/auth) (Módulo SDK V10)
* [Firebase Firestore](https://firebase.google.com/docs/firestore) (Módulo SDK V10)

**Bibliotecas de Terceiros (CDNs):**
* [Chart.js](https://www.chartjs.org/) (Renderização de gráficos no Canvas)
* [Phosphor Icons](https://phosphoricons.com/) (Ícones vetoriais modernos e consistentes)
* [Google Fonts - Inter](https://fonts.google.com/specimen/Inter) (Tipografia)

---

## 🚀 Como Executar Localmente

### Pré-requisitos
Devido às restrições de segurança (CORS) de módulos JavaScript modernos e do serviço Firebase em navegadores executando arquivos diretamente pelo protocolo `file://`, você **precisa de um Servidor Local (Local HTTP Server)** para rodar o projeto.

### Passos de Instalação e Execução

1. **Clone o repositório:**
    ```bash
    git clone https://github.com/SEU-USUARIO/adsdash.git
    cd adsdash
    ```

2. **Configuração do Firebase:**
    - Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
    - Ative o **Authentication** (Provedor: Email/Senha).
    - Ative o **Firestore Database** (inicie em Modo de Teste ou ajuste as Security Rules para leitura e gravação autorizada).
    - Registre um aplicativo Web no projeto para obter suas Chaves de API.
    - Abra o arquivo `firebase-config.js` na raiz do projeto e substitua o objeto `firebaseConfig` com as chaves geradas pelo console do Firebase:
    ```javascript
    export const firebaseConfig = {
      apiKey: "SUA_API_KEY",
      authDomain: "seu-app.firebaseapp.com",
      projectId: "seu-projeto-id",
      storageBucket: "seu-app.firebasestorage.app",
      messagingSenderId: "1234567890",
      appId: "1:1234567890:web:abcdef123456",
      measurementId: "G-ABCEDF1234"
    };
    ```

3. **Iniciando o Servidor Local:**
   Você pode rodar o projeto utilizando qualquer servidor HTTP simples. Exemplos:
   
   - **Usando VS Code:** Instale a extensão *Live Server* e clique no botão "Go Live" no canto inferior direito.
   - **Usando Node.js (npx):**
     ```bash
     npx serve .
     ```
   - **Usando Python 3:**
     ```bash
     python -m http.server
     ```

4. **Acessar a Aplicação:**
   Abra seu navegador no endereço indicado pelo seu servidor (geralmente `http://localhost:3000` ou `http://localhost:5500`). Crie sua primeira conta na tela de autenticação e você estará pronto para usar!

---




> Projeto desenvolvido por design intencional sem a utilização de frameworks genéricos para a interface, visando flexibilidade máxima e estética apurada.
