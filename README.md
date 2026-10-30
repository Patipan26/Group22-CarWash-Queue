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

Docker Compose จะเปิด MySQL, API, Frontend และ phpMyAdmin แยกจากโปรแกรมที่ติดตั้งในเครื่อง โดยใช้พอร์ต `10300`, `3200`, `6200` และ `14300` ตามลำดับ

พอร์ตฝั่งเครื่องสามารถเปลี่ยนได้ ถ้าเครื่องอื่นใช้พอร์ตเดิมอยู่:

```powershell
cd 'E:\IT PROJECT\Friday'
Copy-Item '.env.docker.example' '.env'
notepad '.env'
```

แก้ค่า `WEB_PORT`, `API_PORT`, `MYSQL_PORT` หรือ `PHPMYADMIN_PORT` ในไฟล์นั้นได้ โดยพอร์ตด้านซ้ายคือพอร์ตที่เปิดบนเครื่อง ส่วนพอร์ตด้านขวาใน `docker-compose.yml` เป็นพอร์ตภายใน container ไม่ต้องแก้

เปิด phpMyAdmin ที่ `http://localhost:14300` แล้วกรอกค่าดังนี้:

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

เปิดเว็บที่ `http://localhost:6200` และหยุดระบบด้วย:

```powershell
docker compose down
```

ข้อมูล MySQL และไฟล์สลิปจะอยู่ใน Docker volumes จึงไม่หายเมื่อหยุด container ปกติ

## Deploy บน VPS ที่มีโปรเจกต์อื่นอยู่แล้ว

ไฟล์ `docker-compose.production.yml` แยก MySQL และ uploads เป็น Docker volumes ของโปรเจกต์ `carwash-queue-live`; ไม่เปิดพอร์ตฐานข้อมูล, API หรือ phpMyAdmin ออกอินเทอร์เน็ต และผูกหน้าเว็บไว้ที่ `127.0.0.1:16200` เพื่อให้ Nginx ของ VPS ส่งต่อจากโดเมน/subdomain แยก การตั้งค่านี้ไม่รีเซ็ตเครื่องและไม่หยุด Compose project อื่น

ก่อน deploy ต้องเตรียม `carwash.carcareku.tech` ให้ชี้ A record ไปยัง IP ของ VPS และตั้ง Nginx virtual host จาก `deploy/nginx-carwash.conf.example` โดยใช้ไฟล์ตั้งค่า TLS ของ VPS ห้ามแก้ A record ของโดเมนหลักหรือแทนที่ config ของโปรเจกต์เดิม

GitHub Actions จะ build และ push image ไป GHCR เมื่อ push เข้า `main`; การ deploy ทำเมื่อกด **Actions → CarWash Queue CI/CD → Run workflow** เท่านั้น ต้องตั้งค่าใน **Settings → Secrets and variables → Actions** ดังนี้:

- Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`, `GHCR_PULL_TOKEN` (กำหนดสิทธิ์ `read:packages`) และ `PRODUCTION_ENV` (เนื้อหาทั้งหมดจากไฟล์ `.env.production`)
- Variables: `APP_URL` (URL HTTPS เต็มของแอป) และ `GOOGLE_CLIENT_ID`

ผู้ใช้บน VPS ต้องมี Docker/Compose และ SSH key ที่ตรงกับ `VPS_SSH_KEY`; key สาธารณะต้องอยู่ใน `authorized_keys` ของผู้ใช้นั้น และผู้ใช้ต้องเรียก Docker ได้ Workflow จะเขียน `PRODUCTION_ENV` เป็นไฟล์ permission จำกัดบน VPS ก่อนเริ่ม container `APP_URL` ที่ยังว่างจะทำให้ขั้น deploy ถูกข้าม แต่ build image ยังทำงานได้

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
2. เพิ่ม Authorized JavaScript origins สำหรับ URL ที่ใช้ทดสอบ เช่น `http://localhost:6200` และ URL Vercel จริง
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

## แต้มสะสมและแจ้งเตือนสถานะ

ลูกค้ารับ 1 แต้มต่อยอดจองทุก 25 บาท เมื่อแอดมินเปลี่ยนสถานะเป็น `completed` แต้มจะแสดงในหน้ารายการของฉัน และระบบป้องกันการให้แต้มซ้ำสำหรับการจองเดิม หน้ารายการของฉันตรวจสอบการเปลี่ยนสถานะทุก 15 วินาทีและแสดง popup เมื่อพบการเปลี่ยนแปลง

ถ้าใช้ฐานข้อมูลเดิม ให้รัน migration นี้ครั้งเดียวก่อนใช้งาน:

```powershell
Get-Content '.\database\migrations\004_loyalty_points.sql' | docker exec -i carwash-mysql mysql -ucarwash -pcarwash_dev_password carwash_queue
```

ฟีเจอร์โปรไฟล์และการแจ้งเตือนต้องเพิ่มตารางอีกชุด ให้รัน migration นี้ครั้งเดียวด้วย:

```powershell
Get-Content '.\database\migrations\005_profile_notifications.sql' | docker exec -i carwash-mysql mysql -ucarwash -pcarwash_dev_password carwash_queue
```

ลูกค้าดูและทำเครื่องหมายการแจ้งเตือนว่าอ่านแล้วได้ที่เมนู **แจ้งเตือน** ส่วนเมนู **โปรไฟล์** ใช้แก้ชื่อและเบอร์โทร เปลี่ยนรหัสผ่าน เพิ่มรถ ดูแต้มสะสม สถิติ และรายการจองล่าสุด

## หมายเหตุเรื่องการชำระเงิน

หน้า payment สร้าง QR PromptPay จาก `PROMPTPAY_NUMBER` และส่งรูปสลิปให้ Slip2Go ตรวจอัตโนมัติ ก่อนจะบันทึกสถานะชำระเงินเป็น `verified` เท่านั้น สลิปที่ไม่มี QR, ตรวจไม่พบ, ซ้ำ, ยอดไม่ตรง หรือบัญชีผู้รับไม่ตรงจะถูกปฏิเสธและไฟล์จะไม่ถูกเก็บ

ก่อนเปิดใช้ ให้ตั้งค่าเหล่านี้ใน `.env` ที่โฟลเดอร์ราก (หรือ `server/.env` เมื่อติดตั้ง API แยก):

```dotenv
SLIP2GO_SECRET=วาง Secret Key จากหน้า API Connect > Authentication
SLIP2GO_RECEIVER_ACCOUNT_TYPE=02001
SLIP2GO_RECEIVER_ACCOUNT_NUMBER=เบอร์_PromptPay_ที่รับเงิน
```

`02001` คือ PromptPay เบอร์โทรศัพท์ หากรับเงินด้วยบัญชีชนิดอื่นให้ตั้ง `SLIP2GO_RECEIVER_ACCOUNT_TYPE` และเลขบัญชีให้ตรงกับร้าน ค่าเลขบัญชีสามารถเว้นว่างเพื่อใช้ `PROMPTPAY_NUMBER` ได้ จากนั้นตั้ง IP ของเซิร์ฟเวอร์ใน Slip2Go IP Whitelist และ rebuild API:

```powershell
docker compose up -d --build api
```

API Secret ใช้ใน backend เท่านั้น อย่าใส่ใน client หรือ commit ค่า Secret จริงขึ้น Git หากไม่ได้ตั้ง Secret หรือบัญชีผู้รับ ระบบจะปิดการรับสลิปไว้และแจ้งให้ตั้งค่าก่อน

ประวัติการตรวจสลิปจาก Slip2Go จะถูกบันทึกในตาราง `slip_verifications` และผูกกับรายการจอง โดยเก็บผลตรวจ รหัสตอบกลับ ยอดเงิน `referenceId` และ `transRef` ส่วนรายการที่ผ่านจะเก็บเลขอ้างอิงไว้ใน `bookings` ด้วย แอดมินเปิดดูได้จากหน้า **Admin > ประวัติผลตรวจ** ในแต่ละรายการจอง หากใช้ฐานข้อมูลเดิม ให้รัน migration นี้ครั้งเดียวก่อน rebuild API:

```powershell
Get-Content '.\database\migrations\008_slip_verification_history.sql' | docker exec -i carwash-mysql mysql -ucarwash -pcarwash_dev_password carwash_queue
docker compose up -d --build api client
```

ระบบจะเริ่มเก็บตั้งแต่การตรวจครั้งถัดไป ประวัติการตรวจเดิมที่ไม่ได้บันทึก `referenceId` ไว้จะไม่สามารถเติมกลับจากฐานข้อมูลเราได้

รายการที่มีสถานะ **รอตรวจสอบ** และแนบสลิปไว้ จะแสดงปุ่ม **อนุมัติชำระเงิน** และ **ปฏิเสธสลิป** ในหน้าแอดมิน เมื่อตรวจสอบด้วยตนเองแล้วอนุมัติ ระบบจะคำนวณ VAT 7% และแจ้งลูกค้า หากปฏิเสธ ลูกค้าจะได้รับแจ้งให้ส่งสลิปใหม่ ระบบจะไม่ให้เลื่อนงานไปขั้นรับรถ/กำลังให้บริการ/เสร็จสิ้นจนกว่าสถานะชำระเงินเป็น `verified`

ไฟล์สลิปและไฟล์แนบไม่ได้เปิดเป็น URL สาธารณะแล้ว การเปิดไฟล์ต้องผ่าน API ที่ตรวจ session และสิทธิ์เจ้าของรายการหรือแอดมิน

## กติกาข้อมูลหลัก

- Standard Wash: ฿250
- Premium Wash: ฿450
- Full Detailing: ฿1,200
- ค่าเริ่มต้นจำกัด 1 คันต่อช่วงเวลา ปรับได้ด้วย `BOOKING_SLOT_CAPACITY`
- ไม่ใช้ Firebase และไม่ให้ React ติดต่อ MySQL โดยตรง

## กฎการจอง

- Backend รับเฉพาะช่วงเวลา 09:00–10:00, 10:00–11:00, 11:00–12:00, 13:00–14:00, 14:00–15:00 และ 15:00–16:00
- ปฏิเสธวันที่ผ่านมาแล้ว โดยอ้างอิงเวลา Asia/Bangkok
- ปิดรับการจองทุกวันอาทิตย์ทั้งหน้าเว็บและ API
- สถานะการจอง: `pending`, `confirmed`, `in_service`, `completed`, `cancelled`
- นับรายการ `pending`, `confirmed` และ `in_service` เป็นคิวที่ใช้ความจุ ส่วน `cancelled` และ `completed` ไม่กินคิว
- Backend อ่านราคาบริการและบริการเสริมจาก MySQL แล้วคำนวณยอดรวมเอง ไม่เชื่อราคาจากหน้าเว็บ
- Endpoint `GET /api/bookings/availability?date=YYYY-MM-DD` ใช้ดูจำนวนคิวคงเหลือของแต่ละช่วงเวลา
- ใช้ MySQL advisory lock ป้องกันคำขอสองรายการจองที่ว่างสุดท้ายพร้อมกัน

หากใช้ฐานข้อมูลเดิม ให้รัน migration เพิ่ม index ครั้งเดียว:

```powershell
Get-Content '.\database\migrations\002_booking_slot_index.sql' | docker exec -i carwash-mysql mysql -ucarwash -pcarwash_dev_password carwash_queue
```

ถ้าใช้ฐานข้อมูลเดิม ให้เพิ่มสถานะ `in_service` สำหรับหน้า Tracking ด้วย:

```powershell
Get-Content '.\database\migrations\006_booking_in_service_status.sql' | docker exec -i carwash-mysql mysql -ucarwash -pcarwash_dev_password carwash_queue
```

ตั้ง `PROMPTPAY_NUMBER` ใน `.env` เพื่อแสดง QR พร้อมยอดเงินที่ต้องชำระ โค้ดส่วนลด `PROMO10` ลด 10% และระบบคำนวณ VAT 7% จากยอดหลังหักส่วนลด

ฐานข้อมูลเดิมต้องเพิ่มช่องสรุปยอดชำระด้วย migration นี้:

```powershell
Get-Content '.\database\migrations\007_payment_summary.sql' | docker exec -i carwash-mysql mysql -ucarwash -pcarwash_dev_password carwash_queue
```
