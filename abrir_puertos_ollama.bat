@echo off
echo Abriendo puertos de Ollama (11434) en el firewall de Windows...
echo.

netsh advfirewall firewall add rule name="Ollama TCP In" dir=in action=allow protocol=TCP localport=11434
netsh advfirewall firewall add rule name="Ollama TCP Out" dir=out action=allow protocol=TCP localport=11434
netsh advfirewall firewall add rule name="Ollama UDP In" dir=in action=allow protocol=UDP localport=11434
netsh advfirewall firewall add rule name="Ollama UDP Out" dir=out action=allow protocol=UDP localport=11434

echo.
echo Verificando reglas creadas...
netsh advfirewall firewall show rule name=all | findstr "Ollama"
echo.
pause
