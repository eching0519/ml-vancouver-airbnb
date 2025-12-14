import PredictionForm from "@/components/PredictionForm";
import Image from "next/image";

export default function Home() {
  return (
    <>
      {/* Background SVG decoration */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <Image
          src="/images/background.svg"
          alt=""
          fill
          className="object-cover"
          priority
          style={{ objectFit: "cover" }}
        />
      </div>

      <main className="min-h-screen px-4 sm:px-6 lg:px-8 relative">
        <div className="w-full max-w-6xl mx-auto">
          {/* Logo aligned with form's left edge */}
          <div className="p-4 pb-0">
            <Image
              src="/images/logo.png"
              alt="Vancasa Logo"
              width={250}
              height={100}
              className="object-contain w-[200px] sm:w-[250px]"
              priority
            />
          </div>

          <PredictionForm />
        </div>
      </main>
    </>
  );
}
