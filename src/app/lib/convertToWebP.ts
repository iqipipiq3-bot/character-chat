export async function convertToWebP(file: File, quality = 0.85): Promise<File> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();
  return new Promise((resolve) => {
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const randomName = crypto.randomUUID().replace(/-/g, "").substring(0, 16);
          resolve(new File([blob], `${randomName}.webp`, { type: "image/webp" }));
        } else {
          resolve(file);
        }
      }, "image/webp", quality);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}
