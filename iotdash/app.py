from flask import Flask, render_template, request, jsonify, send_file
from flask_socketio import SocketIO                                          
import mysql.connector
from datetime import datetime
import csv
import io
import pickle
import pandas as pd

app = Flask(__name__)
socketio = SocketIO(app)

DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "iotdatabase"
}

# --- PEMUATAN MODEL MACHINE LEARNING SEDERHANA ---
MODEL_FILENAME = "model_15min14.pkl" # Ganti dengan nama file model sederhana Anda
model = None

try:
    with open(MODEL_FILENAME, "rb") as f:
        model = pickle.load(f)
    print(f"✅ Model '{MODEL_FILENAME}' berhasil dimuat.")
except FileNotFoundError:
    print(f"❌ Error: File model '{MODEL_FILENAME}' tidak ditemukan. Endpoint prediksi tidak akan berfungsi.")
except Exception as e:
    print(f"❌ Error saat memuat model '{MODEL_FILENAME}': {e}")

@app.route("/")
def index():
    # Fungsi ini tidak berubah
    conn = None
    cursor = None
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM sensor_data ORDER BY id DESC LIMIT 1")
        latest_data_for_template = cursor.fetchone()
        return render_template("index.html", data=latest_data_for_template)
    except Exception as e:
        print(f"Error fetching data for index: {e}")
        return render_template("index.html", data=None)
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

@app.route("/upload", methods=["POST"])
def upload():
    # Fungsi ini tidak berubah
    data = request.form
    temperature = data.get("temperature")
    humidity = data.get("humidity")
    air_quality = data.get("air_quality")
    gas_alert = data.get("gas_alert")
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    conn = None
    cursor = None
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO sensor_data (timestamp, temperature, humidity, air_quality, gas_alert) VALUES (%s, %s, %s, %s, %s)",
            (timestamp, temperature, humidity, air_quality, gas_alert)
        )
        conn.commit()
        socketio.emit('sensor_data', {
            "temperature": temperature,
            "humidity": humidity,
            "air_quality": air_quality,
            "gas_alert": gas_alert,
            "timestamp": timestamp
        })
        return jsonify({"status": "success"}), 200
    except Exception as e:
        print(f"Error during upload: {e}")
        if conn: conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

@app.route("/latest")
def latest_data():
    # Fungsi ini tidak berubah
    conn = None
    cursor = None
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT temperature, humidity, air_quality FROM sensor_data ORDER BY id DESC LIMIT 1")
        data = cursor.fetchone()
        return jsonify(data if data else {"temperature": None, "humidity": None, "air_quality": None})
    except Exception as e:
        print(f"Error fetching latest data: {e}")
        return jsonify({"error": "Could not fetch latest data"}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# --- RUTE PREDIKSI YANG DISESUAIKAN UNTUK MODEL SEDERHANA ---
@app.route("/predict", methods=["POST"])
def predict():
    if model is None:
        return jsonify({"error": f"Model '{MODEL_FILENAME}' tidak dimuat."}), 503

    try:
        data = request.get_json()
        if not data: return jsonify({"error": "Request body harus berupa JSON."}), 400

        temperature = data.get("temperature")
        humidity = data.get("humidity")
        air_quality = data.get("air_quality")

        if any(v is None for v in [temperature, humidity, air_quality]):
            return jsonify({"error": "Data tidak lengkap untuk prediksi."}), 400
        
        # Buat DataFrame input HANYA dengan 3 fitur yang sesuai dengan model
        input_features = pd.DataFrame([[
            float(temperature),
            float(humidity),
            float(air_quality)
        ]], columns=['Temperature (°C)', 'Humidity (%)', 'Air Quality (PPM)'])

        predicted_values = model.predict(input_features)[0]
        
        return jsonify({
            "temperature_next": float(predicted_values[0]),
            "humidity_next": float(predicted_values[1]),
            "air_quality_next": float(predicted_values[2])
        })
    except (ValueError, TypeError) as e:
        return jsonify({"error": f"Tipe data tidak valid: {e}"}), 400
    except Exception as e:
        print(f"❌ Error saat prediksi: {e}")
        return jsonify({"error": "Terjadi kesalahan internal saat prediksi."}), 500

@app.route("/download")
def download_csv():
    # Fungsi ini tidak berubah
    conn = None
    cursor = None
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT timestamp, temperature, humidity, air_quality, gas_alert FROM sensor_data ORDER BY id DESC")
        rows = cursor.fetchall()
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Timestamp", "Temperature", "Humidity", "Air Quality", "Gas Alert"])
        writer.writerows(rows)

        output.seek(0)
        return send_file(io.BytesIO(output.getvalue().encode('utf-8')),
                         mimetype="text/csv",
                         download_name="latest_records.csv",
                         as_attachment=True)
    except Exception as e:
        print(f"Error during CSV download: {e}")
        return "Error generating CSV file.", 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()  

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)