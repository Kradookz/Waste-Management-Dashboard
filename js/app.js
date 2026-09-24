import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
    getDatabase,
    ref,
    onValue,
    query,
    orderByChild,
    limitToLast,
    get
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";


// ================= Firebase Configuration =================

const firebaseConfig = {

    apiKey: "AIzaSyA0v_kI4MxmirqByCk3PhvLXseZnotKzHo",

    authDomain:
        "wastemanagement-b5cfd.firebaseapp.com",

    databaseURL:
        "https://wastemanagement-b5cfd-default-rtdb.asia-southeast1.firebasedatabase.app",

    projectId:
        "wastemanagement-b5cfd",

    storageBucket:
        "wastemanagement-b5cfd.firebasestorage.app",

    messagingSenderId:
        "1038304617347",

    appId:
        "1:1038304617347:web:ef68ddcdadc87e78628cb6"
};


// ================= Initialize Firebase =================

const app =
    initializeApp(firebaseConfig);

const db =
    getDatabase(app);

console.log("Firebase Connected!");


// ============================================================
// NOTIFICATION STATE
// ============================================================

// Bin notification state (Full)

let bin1Notified = false;
let bin2Notified = false;


// Battery notification state

let battery1LastStatus = "good";
let battery2LastStatus = "good";


// ---- NEW: Bin online/offline tracking ----

// เก็บ timestamp ล่าสุดที่ได้รับข้อมูลจากแต่ละถัง (มาจาก ESP32 lastSeen)

let bin1LastSeen = null;
let bin2LastSeen = null;

// เก็บสถานะออนไลน์ล่าสุด เพื่อเทียบว่าสถานะเปลี่ยนหรือยัง (กันแจ้งเตือนซ้ำทุกครั้ง)

let bin1OnlineStatus = "online";
let bin2OnlineStatus = "online";

// ถ้าไม่มีข้อมูลใหม่เข้ามานานเกินนี้ ถือว่าถังนั้นออฟไลน์
// ปรับตามรอบส่งข้อมูลจริงของ ESP32 (แนะนำ 2-3 เท่าของรอบส่งปกติ)

const OFFLINE_THRESHOLD_MS = 20 * 1000; // 20 วินาที (ชั่วคราว)


// ============================================================
// NOTIFICATION QUEUE
// ============================================================

// เก็บ Notification ที่รอแสดง

const notificationQueue = [];


// ป้องกันไม่ให้ Notification หลายอันแสดงพร้อมกัน

let notificationShowing = false;


// ============================================================
// NOTIFICATION FUNCTION
// ============================================================

function showNotification(message) {

    // เพิ่มข้อความเข้า Queue

    notificationQueue.push(message);


    // เริ่มประมวลผล Queue

    processNotificationQueue();

}


function processNotificationQueue() {

    // ถ้ากำลังแสดง Notification อยู่
    // หรือไม่มีข้อความใน Queue
    // ให้หยุดก่อน

    if (
        notificationShowing ||
        notificationQueue.length === 0
    ) {

        return;

    }


    const notification =
        document.getElementById(
            "notification"
        );

    const text =
        document.getElementById(
            "notification-text"
        );


    // ตรวจสอบ HTML

    if (
        !notification ||
        !text
    ) {

        console.error(
            "Notification element not found!"
        );

        return;

    }


    // ดึงข้อความแรกออกจาก Queue

    const message =
        notificationQueue.shift();


    // แสดงข้อความ

    text.textContent =
        message;

    notification.style.display =
        "block";


    notificationShowing =
        true;


    console.log(
        "Notification:",
        message
    );


    // แสดง Notification 3 วินาที

    setTimeout(() => {

        notification.style.display =
            "none";


        notificationShowing =
            false;


        // ถ้ามี Notification ต่อไป
        // ให้แสดงต่อ

        processNotificationQueue();


    }, 3000);

}


// ============================================================
// BIN STATUS FUNCTION
// ============================================================

function getBinStatus(level) {

    if (level >= 90) {

        return {

            text:
                "🔴 Full",

            statusClass:
                "full",

            progressClass:
                "red"

        };

    }


    if (level >= 70) {

        return {

            text:
                "🟡 Warning",

            statusClass:
                "warning",

            progressClass:
                "yellow"

        };

    }


    return {

        text:
            "🟢 Normal",

        statusClass:
            "normal",

        progressClass:
            "green"

    };

}


// ============================================================
// ONLINE / OFFLINE STATUS FUNCTIONS (NEW)
// ============================================================

function checkOnline(lastSeen) {

    if (!lastSeen) {

        return false;

    }


    const timeSinceLastSeen =
        Date.now() - lastSeen;


    return timeSinceLastSeen <= OFFLINE_THRESHOLD_MS;

}


function updateBin1OnlineBadge() {

    const bin1OnlineElement =
        document.getElementById("bin1-online");

    if (!bin1OnlineElement) {

        return;

    }


    const isOnline =
        checkOnline(bin1LastSeen);


    if (isOnline) {

        bin1OnlineElement.textContent = "🟢 Online";
        bin1OnlineElement.className = "online-status online";

    } else {

        bin1OnlineElement.textContent = "🔴 Offline";
        bin1OnlineElement.className = "online-status offline";

    }


    const newStatus =
        isOnline ? "online" : "offline";


    if (newStatus !== bin1OnlineStatus) {

        if (newStatus === "offline") {

            showNotification("🔴 Bin 1 ขาดการเชื่อมต่อ!");

        } else {

            showNotification("🟢 Bin 1 กลับมาออนไลน์แล้ว");

        }


        bin1OnlineStatus = newStatus;

    }

}


function updateBin2OnlineBadge() {

    const bin2OnlineElement =
        document.getElementById("bin2-online");

    if (!bin2OnlineElement) {

        return;

    }


    const isOnline =
        checkOnline(bin2LastSeen);


    if (isOnline) {

        bin2OnlineElement.textContent = "🟢 Online";
        bin2OnlineElement.className = "online-status online";

    } else {

        bin2OnlineElement.textContent = "🔴 Offline";
        bin2OnlineElement.className = "online-status offline";

    }


    const newStatus =
        isOnline ? "online" : "offline";


    if (newStatus !== bin2OnlineStatus) {

        if (newStatus === "offline") {

            showNotification("🔴 Bin 2 ขาดการเชื่อมต่อ!");

        } else {

            showNotification("🟢 Bin 2 กลับมาออนไลน์แล้ว");

        }


        bin2OnlineStatus = newStatus;

    }

}


// ============================================================
// CHART HISTORY
// ============================================================

const chartLabels = [];

const bin1History = [];

const bin2History = [];


// ============================================================
// CHART
// ============================================================

const ctx =
    document.getElementById(
        "wasteChart"
    );


const wasteChart =
    new Chart(
        ctx,
        {

            type: "line",

            data: {

                labels:
                    chartLabels,

                datasets: [

                    {
                        label:
                            "Bin 1",

                        data:
                            bin1History,

                        borderColor:
                            "#2E86DE",

                        backgroundColor:
                            "#2E86DE",

                        borderDash:
                            [6, 4],

                        tension:
                            0
                    },

                    {
                        label:
                            "Bin 2",

                        data:
                            bin2History,

                        borderColor:
                            "#E67E22",

                        backgroundColor:
                            "#E67E22",

                        tension:
                            0
                    }

                ]

            },

            options: {

                responsive:
                    true,

                plugins: {

                    legend: {

                        position:
                            "top"

                    }

                },

                scales: {

                    y: {

                        beginAtZero:
                            true,

                        max:
                            100

                    }

                }

            }

        }
    );


// ============================================================
// BATTERY MONITORING
// ============================================================

const batteryRef =
    ref(
        db,
        "battery"
    );


console.log(
    "กำลังรอข้อมูล Battery..."
);


onValue(

    batteryRef,

    (snapshot) => {

        console.log(
            "Battery Listener ทำงานแล้ว!"
        );


        const batteryData =
            snapshot.val();


        console.log(
            "Battery Data:"
        );

        console.log(
            batteryData
        );


        // ถ้าไม่มีข้อมูล Battery

        if (!batteryData) {

            console.warn(
                "ไม่พบข้อมูล Battery ใน Firebase"
            );

            return;

        }


        // ====================================================
        // BIN 1 BATTERY
        // ====================================================

        const battery1 =
            batteryData.bin1;


        if (battery1) {

            const battery1Percent =
                Number(
                    battery1.percent
                );


            const battery1Voltage =
                Number(
                    battery1.voltage
                );


            // ================= Percent =================

            document.getElementById(
                "battery1-percent"
            ).textContent =
                battery1Percent;


            // ================= Progress =================

            const battery1Progress =
                document.getElementById(
                    "battery1-progress"
                );


            battery1Progress.style.width =
                battery1Percent + "%";


            // ================= Voltage =================

            document.getElementById(
                "battery1-voltage"
            ).textContent =
                battery1Voltage.toFixed(2);


            // ================= Battery Status =================

            const battery1StatusElement =
                document.getElementById(
                    "battery1-status"
                );


            let battery1Status;


            // Good

            if (
                battery1Percent >= 60
            ) {

                battery1Status =
                    "good";


                battery1StatusElement.textContent =
                    "🟢 Good";


                battery1StatusElement.className =
                    "battery-status battery-good";


                // Progress = Green

                battery1Progress.className =
                    "battery-progress battery-good";

            }


            // Low

            else if (
                battery1Percent >= 30
            ) {

                battery1Status =
                    "low";


                battery1StatusElement.textContent =
                    "🟡 Low";


                battery1StatusElement.className =
                    "battery-status battery-warning";


                // Progress = Yellow

                battery1Progress.className =
                    "battery-progress battery-warning";

            }


            // Critical

            else {

                battery1Status =
                    "critical";


                battery1StatusElement.textContent =
                    "🔴 Critical";


                battery1StatusElement.className =
                    "battery-status battery-critical";


                // Progress = Red

                battery1Progress.className =
                    "battery-progress battery-critical";

            }


            // ====================================================
            // BIN 1 BATTERY NOTIFICATION
            // ====================================================

            if (
                battery1Status !==
                battery1LastStatus
            ) {

                if (
                    battery1Status ===
                    "critical"
                ) {

                    showNotification(
                        "🚨 Bin 1 Battery Critical!"
                    );

                }


                else if (
                    battery1Status ===
                    "low"
                ) {

                    showNotification(
                        "⚠️ Bin 1 Battery Low!"
                    );

                }


                else if (
                    battery1Status ===
                    "good"
                ) {

                    showNotification(
                        "🟢 Bin 1 Battery Good!"
                    );

                }


                // จำสถานะใหม่

                battery1LastStatus =
                    battery1Status;

            }

        }


        // ====================================================
        // BIN 2 BATTERY
        // ====================================================

        const battery2 =
            batteryData.bin2;


        if (battery2) {

            const battery2Percent =
                Number(
                    battery2.percent
                );


            const battery2Voltage =
                Number(
                    battery2.voltage
                );


            // ================= Percent =================

            document.getElementById(
                "battery2-percent"
            ).textContent =
                battery2Percent;


            // ================= Progress =================

            const battery2Progress =
                document.getElementById(
                    "battery2-progress"
                );


            battery2Progress.style.width =
                battery2Percent + "%";


            // ================= Voltage =================

            document.getElementById(
                "battery2-voltage"
            ).textContent =
                battery2Voltage.toFixed(2);


            // ================= Battery Status =================

            const battery2StatusElement =
                document.getElementById(
                    "battery2-status"
                );


            let battery2Status;


            // Good

            if (
                battery2Percent >= 60
            ) {

                battery2Status =
                    "good";


                battery2StatusElement.textContent =
                    "🟢 Good";


                battery2StatusElement.className =
                    "battery-status battery-good";


                // Progress = Green

                battery2Progress.className =
                    "battery-progress battery-good";

            }


            // Low

            else if (
                battery2Percent >= 30
            ) {

                battery2Status =
                    "low";


                battery2StatusElement.textContent =
                    "🟡 Low";


                battery2StatusElement.className =
                    "battery-status battery-warning";


                // Progress = Yellow

                battery2Progress.className =
                    "battery-progress battery-warning";

            }


            // Critical

            else {

                battery2Status =
                    "critical";


                battery2StatusElement.textContent =
                    "🔴 Critical";


                battery2StatusElement.className =
                    "battery-status battery-critical";


                // Progress = Red

                battery2Progress.className =
                    "battery-progress battery-critical";

            }


            // ====================================================
            // BIN 2 BATTERY NOTIFICATION
            // ====================================================

            if (
                battery2Status !==
                battery2LastStatus
            ) {

                if (
                    battery2Status ===
                    "critical"
                ) {

                    showNotification(
                        "🚨 Bin 2 Battery Critical!"
                    );

                }


                else if (
                    battery2Status ===
                    "low"
                ) {

                    showNotification(
                        "⚠️ Bin 2 Battery Low!"
                    );

                }


                else if (
                    battery2Status ===
                    "good"
                ) {

                    showNotification(
                        "🟢 Bin 2 Battery Good!"
                    );

                }


                // จำสถานะใหม่

                battery2LastStatus =
                    battery2Status;

            }

        }

    }

);


// ============================================================
// BIN MONITORING
// ============================================================

const binsRef =
    ref(
        db,
        "bins"
    );


console.log(
    "กำลังรอข้อมูล Bins..."
);


onValue(

    binsRef,

    (snapshot) => {

        console.log(
            "Bins Listener ทำงานแล้ว!"
        );


        const data =
            snapshot.val();


        console.log(
            "ข้อมูลจาก Firebase:"
        );

        console.log(
            data
        );


        // ถ้าไม่มีข้อมูล

        if (!data) {

            console.warn(
                "ไม่พบข้อมูล Bins ใน Firebase"
            );

            return;

        }


        // ====================================================
        // BIN 1
        // ====================================================

        const bin1 =
            data.bin1;


        if (!bin1) {

            console.warn(
                "ไม่พบข้อมูล Bin 1"
            );

        }


        else {

            const bin1Level =
                Number(
                    bin1.level
                );


            const bin1Status =
                getBinStatus(
                    bin1Level
                );


            // ================= Progress =================

            document.getElementById(
                "bin1-progress"
            ).style.width =
                bin1Level + "%";


            document.getElementById(
                "bin1-progress"
            ).className =
                "progress " +
                bin1Status.progressClass;


            // ================= Percentage =================

            document.getElementById(
                "bin1-percentage"
            ).textContent =
                bin1Level + "%";


            // ================= Status =================

            const bin1StatusElement =
                document.getElementById(
                    "bin1-status"
                );


            bin1StatusElement.textContent =
                bin1Status.text;


            bin1StatusElement.className =
                "status " +
                bin1Status.statusClass;


            // ================= Online (เช็คจาก lastSeen) =================

            bin1LastSeen =
                bin1.lastSeen ? Number(bin1.lastSeen) : bin1LastSeen;


            updateBin1OnlineBadge();


            // ====================================================
            // BIN 1 FULL NOTIFICATION
            // ====================================================

            if (
                bin1Level >= 90 &&
                !bin1Notified
            ) {

                showNotification(
                    "⚠️ Bin 1 is Full!"
                );


                bin1Notified =
                    true;

            }


            if (
                bin1Level < 90
            ) {

                bin1Notified =
                    false;

            }

        }


        // ====================================================
        // BIN 2
        // ====================================================

        const bin2 =
            data.bin2;


        if (!bin2) {

            console.warn(
                "ไม่พบข้อมูล Bin 2"
            );

        }


        else {

            const bin2Level =
                Number(
                    bin2.level
                );


            const bin2Status =
                getBinStatus(
                    bin2Level
                );


            // ================= Progress =================

            document.getElementById(
                "bin2-progress"
            ).style.width =
                bin2Level + "%";


            document.getElementById(
                "bin2-progress"
            ).className =
                "progress " +
                bin2Status.progressClass;


            // ================= Percentage =================

            document.getElementById(
                "bin2-percentage"
            ).textContent =
                bin2Level + "%";


            // ================= Status =================

            const bin2StatusElement =
                document.getElementById(
                    "bin2-status"
                );


            bin2StatusElement.textContent =
                bin2Status.text;


            bin2StatusElement.className =
                "status " +
                bin2Status.statusClass;


            // ================= Online (เช็คจาก lastSeen) =================

            bin2LastSeen =
                bin2.lastSeen ? Number(bin2.lastSeen) : bin2LastSeen;


            updateBin2OnlineBadge();


            // ====================================================
            // BIN 2 FULL NOTIFICATION
            // ====================================================

            if (
                bin2Level >= 90 &&
                !bin2Notified
            ) {

                showNotification(
                    "⚠️ Bin 2 is Full!"
                );


                bin2Notified =
                    true;

            }


            if (
                bin2Level < 90
            ) {

                bin2Notified =
                    false;

            }

        }


        // ====================================================
        // OVERVIEW
        // ====================================================

        const totalBins =
            2;


        let fullBins =
            0;


        let warningBins =
            0;


        let onlineBins =
            0;


        // ================= Bin 1 =================

        if (bin1) {

            const bin1Level =
                Number(
                    bin1.level
                );


            if (
                bin1Level >= 90
            ) {

                fullBins++;

            }


            else if (
                bin1Level >= 70
            ) {

                warningBins++;

            }


            // นับ online จากผล lastSeen จริง ไม่ใช่ field online เดิม

            if (
                checkOnline(bin1LastSeen)
            ) {

                onlineBins++;

            }

        }


        // ================= Bin 2 =================

        if (bin2) {

            const bin2Level =
                Number(
                    bin2.level
                );


            if (
                bin2Level >= 90
            ) {

                fullBins++;

            }


            else if (
                bin2Level >= 70
            ) {

                warningBins++;

            }


            // นับ online จากผล lastSeen จริง ไม่ใช่ field online เดิม

            if (
                checkOnline(bin2LastSeen)
            ) {

                onlineBins++;

            }

        }


        // ================= Display Overview =================

        document.getElementById(
            "total-bins"
        ).textContent =
            totalBins;


        document.getElementById(
            "full-bins"
        ).textContent =
            fullBins;


        document.getElementById(
            "warning-bins"
        ).textContent =
            warningBins;


        document.getElementById(
            "online-bins"
        ).textContent =
            onlineBins;


        // ====================================================
        // LAST UPDATE
        // ====================================================

        const now =
            new Date();


        document.getElementById(
            "update-date"
        ).textContent =
            now.toLocaleDateString(
                "en-GB",
                {

                    day:
                        "2-digit",

                    month:
                        "long",

                    year:
                        "numeric"

                }
            );


        document.getElementById(
            "update-time"
        ).textContent =
            now.toLocaleTimeString(
                "en-GB",
                {

                    hour:
                        "2-digit",

                    minute:
                        "2-digit",

                    second:
                        "2-digit",

                    hour12:
                        false

                }
            );


        // ====================================================
        // UPDATE CHART
        // ====================================================

        const currentTime =
            new Date().toLocaleTimeString(
                [],
                {

                    hour:
                        "2-digit",

                    minute:
                        "2-digit"

                }
            );


        chartLabels.push(
            currentTime
        );


        // ถ้าไม่มี Bin ให้ใส่ null

        bin1History.push(
            bin1
                ? Number(bin1.level)
                : null
        );


        bin2History.push(
            bin2
                ? Number(bin2.level)
                : null
        );


        // เก็บแค่ 20 จุดล่าสุด

        if (
            chartLabels.length > 20
        ) {

            chartLabels.shift();

            bin1History.shift();

            bin2History.shift();

        }


        wasteChart.update();

    }

);


// ============================================================
// เช็คสถานะออนไลน์ทุก 1 นาที (NEW)
// เผื่อกรณีไม่มีข้อมูลใหม่เข้ามาเลย onValue จะไม่ทำงานซ้ำ
// เพราะ Firebase ยิง event แค่ตอนข้อมูลเปลี่ยน ถ้าถังหลุดไปแล้ว
// จะไม่มีข้อมูลใหม่ให้ยิง event เลย ต้องเช็คเองตามเวลาแทน
// ============================================================

setInterval(() => {

    updateBin1OnlineBadge();

    updateBin2OnlineBadge();

}, 60 * 1000);


// ============================================================
// HISTORY TABLE (NEW)
// ============================================================

// แปลง timestamp (epoch ms) เป็นวันที่/เวลาอ่านง่าย

function formatTimestamp(ts) {

    const date =
        new Date(ts);


    return date.toLocaleString(
        "en-GB",
        {

            day: "2-digit",

            month: "2-digit",

            year: "numeric",

            hour: "2-digit",

            minute: "2-digit"

        }
    );

}


// แสดงแค่ 100 รายการล่าสุดในตาราง (กันหน้าเว็บช้าถ้าข้อมูลสะสมเยอะ)
// ปุ่มดาวน์โหลด CSV ด้านล่างจะดึงข้อมูลทั้งหมดแยกต่างหาก ไม่ถูกจำกัดแบบนี้

const historyQuery =
    query(
        ref(db, "history/bin1"),
        orderByChild("timestamp"),
        limitToLast(100)
    );


onValue(

    historyQuery,

    (snapshot) => {

        const historyData =
            snapshot.val();


        const tableBody =
            document.getElementById(
                "history-table-body"
            );


        if (!tableBody) {

            return;

        }


        tableBody.innerHTML = "";


        if (!historyData) {

            return;

        }


        // แปลง object เป็น array แล้วเรียงล่าสุดขึ้นก่อน

        const entries =
            Object.values(historyData).sort(
                (a, b) => b.timestamp - a.timestamp
            );


        entries.forEach((entry) => {

            const row =
                document.createElement("tr");


            const fillLevelText =
                entry.sensorError
                    ? "⚠️ Sensor Error"
                    : entry.fillLevel + "%";


            row.innerHTML =
                "<td>" + formatTimestamp(entry.timestamp) + "</td>" +
                "<td>" + fillLevelText + "</td>" +
                "<td>" + entry.batteryPercent + "%</td>";


            tableBody.appendChild(row);

        });

    }

);


// ============================================================
// CSV DOWNLOAD (NEW)
// ============================================================

// ดึงข้อมูลทั้งหมด (ไม่จำกัด 100 แบบตาราง) ตอนกดปุ่มเท่านั้น

function downloadCSV() {

    get(
        ref(db, "history/bin1")
    ).then((snapshot) => {

        const historyData =
            snapshot.val();


        if (!historyData) {

            alert("ยังไม่มีข้อมูลย้อนหลัง");

            return;

        }


        const entries =
            Object.values(historyData).sort(
                (a, b) => a.timestamp - b.timestamp
            );


        let csv =
            "Timestamp,DateTime,FillLevel(%),BatteryPercent(%),SensorError\n";


        entries.forEach((entry) => {

            csv +=
                entry.timestamp + "," +
                formatTimestamp(entry.timestamp) + "," +
                (entry.sensorError ? "" : entry.fillLevel) + "," +
                entry.batteryPercent + "," +
                entry.sensorError +
                "\n";

        });


        const blob =
            new Blob(
                [csv],
                { type: "text/csv" }
            );


        const url =
            URL.createObjectURL(blob);


        const link =
            document.createElement("a");


        link.href = url;

        link.download =
            "bin1_history_" + Date.now() + ".csv";


        link.click();


        URL.revokeObjectURL(url);


        console.log(
            "CSV Downloaded:",
            entries.length,
            "rows"
        );

    }).catch((error) => {

        console.error(
            "CSV Download Error:",
            error
        );

        alert("ดาวน์โหลดไม่สำเร็จ ลองใหม่อีกครั้ง");

    });

}


const downloadButton =
    document.getElementById("download-csv-btn");


if (downloadButton) {

    downloadButton.addEventListener(
        "click",
        downloadCSV
    );

}
