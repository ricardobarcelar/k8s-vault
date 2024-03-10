const http = require('http');
const { execSync } = require('child_process');

const server = http.createServer((req, res) => {
    const user = process.env.USER;
    const senha = process.env.SENHA;

    // Exibindo a secret em uma página HTML
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Secret Kubernetes</title>
        </head>
        <body>
            <h1>Usuario: ${user}</h1>
            <h1>Senha: ${senha}</h1>
        </body>
        </html>
    `;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(htmlContent);
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
