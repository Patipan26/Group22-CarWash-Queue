# CarWash Queue

ระบบจองคิวล้างรถที่เริ่มใหม่จากหน้า HTML เดิม โดยใช้ React + Tailwind CSS, Node.js + Express และ MySQL แทน Firebase

## โครงสร้าง

- `client` — React 18 + Vite + Tailwind CSS
- `server` — Node.js 20 + Express 4 REST API
- `database` — MySQL schema และ seed data

## เริ่มต้นใช้งาน

1. สร้างฐานข้อมูล MySQL แล้วรัน `database/schema.sql` และ `database/seed.sql`
2. คัดลอก `server/.env.example` เป็น `server/.env` แล้วใส่ค่าการเชื่อมต่อ MySQL
3. ติดตั้ง dependencies ใน `client` และ `server`
4. เปิด server ที่พอร์ต 3000 และ client ที่พอร์ต 5173

```powershell
cd 'E:\IT PROJECT\Friday\server'
npm install
npm run dev

cd 'E:\IT PROJECT\Friday\client'
npm install
npm run dev
```

## รันด้วย Docker

Docker Compose จะเปิด MySQL, API, Frontend และ phpMyAdmin แยกจากโปรแกรมที่ติดตั้งในเครื่อง โดยใช้พอร์ต `3307`, `3001`, `5174` และ `18081` ตามลำดับ

พอร์ตฝั่งเครื่องสามารถเปลี่ยนได้ ถ้าเครื่องอื่นใช้พอร์ตเดิมอยู่:

```powershell
cd 'E:\IT PROJECT\Friday'
Copy-Item '.env.docker.example' '.env'
notepad '.env'
```

แก้ค่า `WEB_PORT`, `API_PORT`, `MYSQL_PORT` หรือ `PHPMYADMIN_PORT` ในไฟล์นั้นได้ โดยพอร์ตด้านซ้ายคือพอร์ตที่เปิดบนเครื่อง ส่วนพอร์ตด้านขวาใน `docker-compose.yml` เป็นพอร์ตภายใน container ไม่ต้องแก้

เปิด phpMyAdmin ที่ `http://localhost:18081` แล้วกรอกค่าดังนี้:

```text
Server: db
Username: carwash
Password: carwash_dev_password
Database: carwash_queue
```

```powershell
cd 'E:\IT PROJECT\Friday'
docker compose up --build
```

เปิดเว็บที่ `http://localhost:5174` และหยุดระบบด้วย:

```powershell
docker compose down
```

ข้อมูล MySQL และไฟล์สลิปจะอยู่ใน Docker volumes จึงไม่หายเมื่อหยุด container ปกติ

## Deploy หน้าเว็บด้วย Vercel และใช้ Express + MySQL ของเราเอง

ไฟล์ `client/vercel.json` เตรียมค่า Build และการเปิดหน้า React Router ให้แล้ว โดยตั้งค่าใน Vercel ดังนี้:

1. Import repository `Patipan26/carwash-queue` เข้า Vercel
2. ตั้ง **Root Directory** เป็น `client`
3. ตั้งค่า Environment Variable:

```text
VITE_API_URL=https://โดเมนของ-Express/api
VITE_GOOGLE_CLIENT_ID=เลข Client ID ของ Google
```

4. Deploy แล้วจด URL ของหน้าเว็บ เช่น `https://carwash-queue.vercel.app`
5. ฝั่ง Express ตั้งค่า `CLIENT_ORIGIN` ให้ตรงกับ URL ของ Vercel
6. หาก Express อยู่คนละโดเมนกับ Vercel ต้องเปิด HTTPS และตั้ง `NODE_ENV=production` เพื่อให้ session cookie ทำงานข้ามโดเมนได้

ตัวอย่างค่าฝั่ง Express:

```text
NODE_ENV=production
CLIENT_ORIGIN=https://carwash-queue.vercel.app
```

ถ้าใช้ Docker รัน Express และ MySQL บนเครื่อง/Server ของเรา ให้ใส่ค่าข้างต้นในไฟล์ `.env` ที่อยู่โฟลเดอร์ราก แล้วเริ่มเฉพาะ API กับฐานข้อมูลได้ด้วย:

```powershell
Copy-Item '.env.docker.example' '.env'
notepad '.env'
docker compose up -d --build db api
```

อย่าใช้ `CLIENT_ORIGIN=http://localhost:...` กับหน้าเว็บที่อยู่บน Vercel เพราะ Vercel จะเรียก `localhost` จากเครื่องของผู้เปิดเว็บ ไม่ใช่เครื่องที่รัน Express

Vercel ใช้สำหรับ Frontend เท่านั้น ส่วน Express ต้องรันบน Server/VPS/บริการ Backend ที่เข้าถึงได้จากอินเทอร์เน็ต และ MySQL ต้องอยู่บนเครื่องหรือบริการฐานข้อมูลที่ Express เชื่อมต่อได้ ห้ามใส่รหัสผ่านฐานข้อมูลใน Vercel ฝั่ง `VITE_*` เพราะตัวแปรเหล่านี้ถูกส่งไปอยู่ใน JavaScript ของผู้ใช้

## Google Login

ระบบใช้ Google Identity Services และให้ Express ตรวจสอบ ID token ก่อนออก cookie ของระบบเอง ไม่ใช้ Firebase

1. สร้าง OAuth 2.0 Client ID แบบ **Web application** ใน Google Cloud
2. เพิ่ม Authorized JavaScript origins สำหรับ URL ที่ใช้ทดสอบ เช่น `http://localhost:5174` และ URL Vercel จริง
3. ใส่ Client ID ใน `client/.env` และ `server/.env`:

```text
# client/.env
VITE_GOOGLE_CLIENT_ID=เลข Client ID ของ Google

# server/.env
GOOGLE_CLIENT_ID=เลข Client ID เดียวกัน
```

ถ้าใช้ Docker ให้ใส่ `GOOGLE_CLIENT_ID` ในไฟล์ `.env` ที่โฟลเดอร์รากไฟล์เดียว แล้ว Docker จะส่งค่าเดียวกันให้ทั้ง API และหน้าเว็บตอน Build

4. ถ้าใช้ฐานข้อมูลเดิม ให้รัน migration Google Login ครั้งเดียว:

```powershell
Get-Content '.\database\migrations\003_google_auth.sql' | docker exec -i carwash-mysql mysql -ucarwash -pcarwash_dev_password carwash_queue
```

5. Restart API และ Frontend แล้วทดสอบปุ่ม Google ในหน้าเข้าสู่ระบบ

Client ID เป็นข้อมูลที่ฝั่งหน้าเว็บใช้ได้ แต่ห้ามเปิดเผยค่า `JWT_SECRET` หรือรหัสผ่านฐานข้อมูล Google จะส่ง ID token กลับมาให้หน้าเว็บ และ Backend จะตรวจสอบลายเซ็น, ผู้ให้บริการ, อายุ token และ Client ID ก่อนสร้าง/เชื่อมบัญชีใน MySQL ตามแนวทาง Google ([การตรวจสอบ Google ID token](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token))

หลังสมัครบัญชีลูกค้าแล้ว หากต้องการกำหนดบัญชีเป็นแอดมิน ให้รัน SQL นี้โดยเปลี่ยนอีเมลให้ตรงกับบัญชี:

```sql
USE carwash_queue;
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

## หมายเหตุเรื่องการชำระเงิน

หน้าจองเก็บสลิปไว้ใน `server/uploads` และตั้งสถานะ `pending_review` เพื่อให้แอดมินตรวจสอบก่อน ระบบยังไม่ได้ผูกผู้ให้บริการตรวจสลิปจริง เพราะต้องใช้ API key ของผู้ให้บริการภายนอกก่อนนำไปใช้งานจริง

## กติกาข้อมูลหลัก

- Standard Wash: ฿250
- Premium Wash: ฿450
- Full Detailing: ฿1,200
- ค่าเริ่มต้นจำกัด 1 คันต่อช่วงเวลา ปรับได้ด้วย `BOOKING_SLOT_CAPACITY`
- สถานะการจอง: `pending`, `confirmed`, `completed`, `cancelled`
- ไม่ใช้ Firebase และไม่ให้ React ติดต่อ MySQL โดยตรง

## กฎการจอง

- Backend รับเฉพาะช่วงเวลา 09:00–10:00, 10:00–11:00, 11:00–12:00, 13:00–14:00, 14:00–15:00 และ 15:00–16:00
- ปฏิเสธวันที่ผ่านมาแล้ว โดยอ้างอิงเวลา Asia/Bangkok
- นับเฉพาะรายการ `pending` และ `confirmed` เป็นคิวที่ใช้ความจุ ส่วน `cancelled` และ `completed` ไม่กินคิว
- Backend อ่านราคาบริการและบริการเสริมจาก MySQL แล้วคำนวณยอดรวมเอง ไม่เชื่อราคาจากหน้าเว็บ
- Endpoint `GET /api/bookings/availability?date=YYYY-MM-DD` ใช้ดูจำนวนคิวคงเหลือของแต่ละช่วงเวลา
- ใช้ MySQL advisory lock ป้องกันคำขอสองรายการจองที่ว่างสุดท้ายพร้อมกัน

หากใช้ฐานข้อมูลเดิม ให้รัน migration เพิ่ม index ครั้งเดียว:

```powershell
Get-Content '.\database\migrations\002_booking_slot_index.sql' | docker exec -i carwash-mysql mysql -ucarwash -pcarwash_dev_password carwash_queue
```
