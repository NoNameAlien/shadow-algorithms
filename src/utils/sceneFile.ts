export const downloadJsonFile = (data: unknown, filename: string) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const readJsonFile = <T>(file: File, onLoad: (data: T) => void, onError: (error: unknown) => void) => {
  const reader = new FileReader();

  reader.onload = () => {
    try {
      onLoad(JSON.parse(String(reader.result)) as T);
    } catch (error) {
      onError(error);
    }
  };

  reader.readAsText(file);
};
