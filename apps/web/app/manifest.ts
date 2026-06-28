import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OpenScore",
    short_name: "OpenScore",
    description: "开源、无广告、中文友好的体育比分与数据查询工具",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f4",
    theme_color: "#2a9d8f",
    icons: []
  };
}

