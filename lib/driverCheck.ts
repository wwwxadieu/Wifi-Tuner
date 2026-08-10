import { getNetworkInfo } from "./networkInfo";
import type { AdapterInfo } from "./types";

export interface DriverAnalysisResult {
  adapter: AdapterInfo | null;
  driverAgeDays: number | null;
  driverAgeYears: number | null;
  status: "up_to_date" | "moderate" | "outdated" | "unknown";
  statusText: string;
  recommendation: string;
  vendorUrl: string;
  vendorName: string;
}

const VENDOR_LINKS: { keyword: string; name: string; url: string }[] = [
  { keyword: "intel", name: "Intel Center", url: "https://www.intel.com/content/www/us/en/download-center/home.html" },
  { keyword: "realtek", name: "Realtek Support", url: "https://www.realtek.com/en/downloads" },
  { keyword: "broadcom", name: "Broadcom Support", url: "https://www.broadcom.com/support" },
  { keyword: "mediatek", name: "MediaTek", url: "https://www.mediatek.com/" },
  { keyword: "ralink", name: "MediaTek/Ralink", url: "https://www.mediatek.com/" },
  { keyword: "qualcomm", name: "Qualcomm", url: "https://www.qualcomm.com/" },
  { keyword: "atheros", name: "Qualcomm Atheros", url: "https://www.qualcomm.com/" },
  { keyword: "tp-link", name: "TP-Link Support", url: "https://www.tp-link.com/vn/support/download/" },
  { keyword: "asus", name: "ASUS Support", url: "https://www.asus.com/support/Download-Center/" },
];

export async function analyzeDriver(): Promise<DriverAnalysisResult> {
  const info = await getNetworkInfo();
  const adapter = info.adapter;

  if (!adapter || !adapter.driverDate) {
    return {
      adapter: adapter || null,
      driverAgeDays: null,
      driverAgeYears: null,
      status: "unknown",
      statusText: "Không xác định",
      recommendation: "Không tìm thấy thông tin ngày phát hành của driver card mạng.",
      vendorUrl: "https://support.microsoft.com/vi-vn/windows",
      vendorName: "Windows Support",
    };
  }

  const driverDate = new Date(adapter.driverDate);
  const now = new Date();
  const diffTime = Math.max(0, now.getTime() - driverDate.getTime());
  const driverAgeDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const driverAgeYears = Math.round((driverAgeDays / 365) * 10) / 10;

  // Identify Vendor
  const providerLower = (adapter.driverProvider || adapter.description || "").toLowerCase();
  const vendor = VENDOR_LINKS.find((v) => providerLower.includes(v.keyword)) || {
    keyword: "generic",
    name: adapter.driverProvider || "Nhà sản xuất",
    url: "https://support.microsoft.com/vi-vn/windows/c%E1%BA%ADp-nh%E1%BA%ADt-tr%C3%ACnh-di%E1%BB%81u-khi%E1%BB%83n-trong-windows-ec62f46c-fac7-222c-4d5b-2f080f86b0b3",
  };

  let status: "up_to_date" | "moderate" | "outdated" = "up_to_date";
  let statusText = "Driver mới (Dưới 1 năm)";
  let recommendation = "Trình điều khiển card mạng của bạn còn rất mới. Không cần cập nhật.";

  if (driverAgeDays > 730) {
    status = "outdated";
    statusText = `Driver quá cũ (${driverAgeYears} năm)`;
    recommendation = `Trình điều khiển được phát hành vào năm ${driverDate.getFullYear()}. Nên cập nhật driver mới nhất từ trang chủ ${vendor.name} hoặc Windows Update để tăng tốc độ và độ ổn định WiFi.`;
  } else if (driverAgeDays > 365) {
    status = "moderate";
    statusText = `Driver ổn định (${driverAgeYears} năm)`;
    recommendation = `Trình điều khiển hoạt động bình thường. Bạn có thể kiểm tra trang chủ ${vendor.name} nếu gặp sự cố chập chờn.`;
  }

  return {
    adapter,
    driverAgeDays,
    driverAgeYears,
    status,
    statusText,
    recommendation,
    vendorUrl: vendor.url,
    vendorName: vendor.name,
  };
}
