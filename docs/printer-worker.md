# Worker local da impressora

O cPanel não consegue aceder diretamente a `192.168.1.10`, porque esse IP é privado. Execute este worker num computador, Raspberry Pi ou NAS na mesma rede da impressora.

## Windows sem terminal

1. Coloque o ficheiro `.env` gerado na página **Comércio → Impressoras** na pasta `scripts` desta cópia do projeto.
2. Faça duplo clique em `Instalar-Worker-Impressora.cmd`.
3. O instalador copia o worker para a sua conta Windows, cria a tarefa **POPForge Printer Worker** e tenta executá-la já.
4. Aguarde um minuto e atualize a página **Impressoras**. Caso continue offline, consulte `%LOCALAPPDATA%\POPForge\PrinterWorker\worker.log`.

1. Registe a impressora em **Comércio → Impressoras** e copie a chave mostrada uma única vez.
2. No equipamento local, configure as variáveis `POPFORGE_URL`, `POPFORGE_PRINTER_ID` e `POPFORGE_PRINTER_KEY`.
3. Se a interface Moonraker/Fluidd não estiver em `:4408`, defina também `PRINTER_STATUS_URL` com o endpoint de estado fornecido pelo firmware.
4. Execute `node scripts/popforge-printer-worker.mjs` a cada 30–60 segundos através do Agendador do Windows, cron, ou um serviço local.

O worker só publica telemetria assinada (estado, ficheiro, progresso e temperaturas); não aceita comandos remotos e não abre a impressora à internet.
