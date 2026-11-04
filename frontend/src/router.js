export function route() {
  return location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
}
export function go(path) {
  location.hash = "#/" + path;
}
