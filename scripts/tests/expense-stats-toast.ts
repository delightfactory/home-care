// Toast delivery is outside the static statistics-card rendering boundary.
const toast = Object.assign(() => {}, { success() {}, error() {}, loading() {}, dismiss() {} });
export { toast };
export default toast;
