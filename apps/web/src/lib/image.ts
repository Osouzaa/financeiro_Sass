/**
 * Recorta a imagem no centro em formato quadrado e reduz para `size` pixels,
 * gerando um JPEG leve (em geral 15–40 KB) para a foto do perfil.
 */
export async function squareThumbnail(file: File, size = 320): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem');

  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível processar a imagem');

  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível processar a imagem'))),
      'image/jpeg',
      0.88,
    ),
  );
}
