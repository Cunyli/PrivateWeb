import { HelsinkiPhotoSession } from "@/components/helsinki-photo-session"

export const metadata = {
  title: "人像约拍 · Lijie",
  description: "与 Lijie 一起拍照。常驻赫尔辛基，接受人像、情侣、毕业和欧洲旅拍预约。Portrait photo sessions in Helsinki and beyond.",
}

export const revalidate = 3600

export default function HelsinkiPhotoSessionPage() {
  return <HelsinkiPhotoSession />
}
