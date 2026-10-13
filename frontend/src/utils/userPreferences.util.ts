const defaultPreferences = [
  {
    key: "colorScheme",
    value: "system",
  },
  {
    key: "locale",
    value: "system",
  },
  {
    key: "uiStyle",
    value: "default",
  },
];

const get = (key: string) => {
  if (typeof window !== "undefined") {
    const preferences = JSON.parse(localStorage.getItem("preferences") ?? "{}");
    return (
      preferences[key] ??
      defaultPreferences.find((p) => p.key == key)?.value ??
      null
    );
  }
};

const set = (key: string, value: string) => {
  if (typeof window !== "undefined") {
    const preferences = JSON.parse(localStorage.getItem("preferences") ?? "{}");
    preferences[key] = value;
    localStorage.setItem("preferences", JSON.stringify(preferences));
  }
};
const userPreferences = {
  get,
  set,
};

export default userPreferences;
