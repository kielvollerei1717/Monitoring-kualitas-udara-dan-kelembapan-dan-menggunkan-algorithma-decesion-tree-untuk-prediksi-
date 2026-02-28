# Monitoring-kualitas-udara-dan-kelembapan-dan-menggunkan-algorithma-decesion-tree-untuk-prediksi-

Tugas akhir IoT dan machine learning untuk moniotring suhu, kelembapan dan kualitas udara (ppm) menggunkanan sensor MQ-135 dan DHT22 dengan web Interface

catatan untuk backend dan juga codingan alat, hanya work kalau Ip Nya sama, kalau mau deploy ke live server, harus dilakukan overhaul 

requiment : 
Flask==3.0.3
Flask-SocketIO==5.3.6
mysql-connector-python==9.0.0
pandas==2.2.2
numpy==1.26.4
scikit-learn==1.5.1
python-socketio==5.11.2
eventlet==0.36.1
simple-websocket==1.0.0
python-engineio==4.9.1

List alat dan sensor yang digunakan

ESP32 with extension board
MQ-135
DHT-22
kabel jumper
mini buzzer 5v
OLED monitor I2C1 128x64d (untuk data live dari sensor)
Resistor 150ohm
Blue LED
Adaptor 5V 2A
Kabel mirco USB
