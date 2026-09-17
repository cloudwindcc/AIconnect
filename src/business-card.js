  const FIELDS = ["contactName", "contactTitle", "companyName", "phone", "email", "website", "countryRegion", "city", "industry", "address", "mainBusiness", "cardNotes"];

  export const createBusinessCardScanner = ({ canEdit, findDuplicate, onSave }) => {
    const dialog = document.getElementById("businessCardDialog");
    const form = document.getElementById("businessCardForm");
    const preview = document.getElementById("businessCardPreview");
    const status = document.getElementById("businessCardStatus");
    const fileInput = document.getElementById("businessCardFile");
    const cameraInput = document.getElementById("businessCardCamera");
    const uploadButton = document.getElementById("uploadBusinessCardButton");
    const captureButton = document.getElementById("captureBusinessCardButton");
    const recognizeButton = document.getElementById("recognizeBusinessCardButton");
    const saveButton = document.getElementById("saveBusinessCardButton");
    const duplicateBox = document.getElementById("businessCardDuplicate");
    const duplicateText = document.getElementById("businessCardDuplicateText");
    let image = "";
    let controller = null;
    let generation = 0;
    let duplicateId = null;
    let busy = false;
    let saving = false;

    function message(text, error = false) {
      status.textContent = text;
      status.classList.toggle("is-error", error);
    }

    function setBusy(value) {
      busy = value;
      uploadButton.disabled = value;
      captureButton.disabled = value;
      recognizeButton.disabled = value || !image;
      form.querySelectorAll("input, select, textarea").forEach((input) => { input.disabled = value; });
      saveButton.disabled = value;
      document.getElementById("closeBusinessCardButton").disabled = saving;
      document.getElementById("cancelBusinessCardButton").disabled = saving;
      dialog.setAttribute("aria-busy", String(value));
    }

    function readDraft() {
      return Object.fromEntries(new FormData(form).entries());
    }

    function updateDuplicate() {
      const draft = readDraft();
      const duplicate = findDuplicate(draft);
      const key = duplicate ? `${draft.recordType}:${duplicate.id}` : null;
      if (key !== duplicateId) form.elements.confirmUpdate.checked = false;
      duplicateId = key;
      duplicateBox.hidden = !duplicate;
      duplicateText.textContent = duplicate
        ? `发现已有${draft.recordType === "company" ? "公司" : "顾问"}：${duplicate.name}。确认后会更新已填写的名片字段，保留原有业务、需求和机会记录。`
        : "";
      saveButton.textContent = duplicate ? "确认更新" : "确认录入";
    }

    function updateRequiredFields() {
      const advisor = form.elements.recordType.value === "advisor";
      form.elements.contactName.required = advisor;
      form.elements.companyName.required = !advisor;
    }

    function close() {
      if (saving) return;
      generation += 1;
      controller?.abort();
      controller = null;
      if (dialog.open) dialog.close();
      image = "";
      preview.removeAttribute("src");
      preview.hidden = true;
      fileInput.value = "";
      cameraInput.value = "";
      form.reset();
      duplicateId = null;
      duplicateBox.hidden = true;
      setBusy(false);
    }

    function open() {
      if (!canEdit()) return;
      close();
      updateRequiredFields();
      updateDuplicate();
      message("选择名片图片，然后点击“识别名片”。");
      dialog.showModal();
    }

    async function selectFile(event) {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !canEdit() || !dialog.open || busy) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        message("仅支持 JPG、PNG、WebP。请将 HEIC 等格式转换后再上传。", true);
        return;
      }
      if (!file.size || file.size > 10 * 1024 * 1024) {
        message("请选择非空图片，单张名片图片不超过 10 MB。", true);
        return;
      }
      const token = ++generation;
      setBusy(true);
      message("正在准备名片图片…");
      try {
        const prepared = await prepareImage(file);
        if (token !== generation || !dialog.open || !canEdit()) return;
        image = prepared;
        preview.src = image;
        preview.hidden = false;
        const type = form.elements.recordType.value;
        form.reset();
        form.elements.recordType.value = type;
        updateRequiredFields();
        message("图片已准备好，点击“识别名片”提取信息。");
      } catch {
        if (token === generation) message("无法读取图片，请重新选择 JPG、PNG 或 WebP 名片照片。", true);
      } finally {
        if (token === generation) { setBusy(false); updateDuplicate(); }
      }
    }

    async function recognize() {
      if (!image || busy || !canEdit()) return;
      const token = ++generation;
      const requestController = new AbortController();
      controller = requestController;
      const timeout = window.setTimeout(() => requestController.abort(), 55000);
      setBusy(true);
      message("正在识别名片，请稍候…");
      try {
        const response = await fetch("/api/scan-business-card", {
          method: "POST", headers: { "Content-Type": "application/json" },
          signal: requestController.signal, body: JSON.stringify({ image }),
        });
        let result;
        try { result = await response.json(); }
        catch { throw new Error("识别接口不可用，请使用 Cloudflare Pages 服务打开页面，或先手动填写。"); }
        if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "识别失败，请重试或手动填写。");
        if (!result?.card || typeof result.card !== "object" || Array.isArray(result.card)) throw new Error("识别结果格式无效，请重试或手动填写。");
        if (token !== generation || !dialog.open || !canEdit()) return;
        for (const field of FIELDS) {
          const value = result.card[field];
          form.elements[field].value = typeof value === "string" ? value.slice(0, form.elements[field].maxLength) : "";
        }
        message("识别完成，请核对姓名、公司和联系方式，再确认录入。");
      } catch (error) {
        if (token === generation) message(error.name === "AbortError" ? "识别超时，请重试或手动填写。" : error.message, true);
      } finally {
        window.clearTimeout(timeout);
        if (token === generation) { controller = null; setBusy(false); updateDuplicate(); }
      }
    }

    form.addEventListener("input", () => { updateRequiredFields(); updateDuplicate(); });
    form.addEventListener("change", () => { updateRequiredFields(); updateDuplicate(); });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy || !canEdit()) return;
      const draft = readDraft();
      for (const field of FIELDS) draft[field] = String(draft[field] || "").trim();
      if (draft.recordType === "company" ? !draft.companyName : !draft.contactName) {
        message(draft.recordType === "company" ? "请填写公司名称。" : "请填写顾问姓名。", true);
        return;
      }
      if (findDuplicate(draft) && !form.elements.confirmUpdate.checked) {
        updateDuplicate();
        message("请勾选确认更新已有记录，或修改名称后新增。", true);
        return;
      }
      try {
        saving = true;
        setBusy(true);
        message("正在保存名片信息…");
        await onSave(draft);
        saving = false;
        close();
      } catch (error) {
        saving = false;
        setBusy(false);
        message(error.message || "录入失败，请重试。", true);
      }
    });
    uploadButton.addEventListener("click", () => { if (canEdit()) fileInput.click(); });
    captureButton.addEventListener("click", () => { if (canEdit()) cameraInput.click(); });
    fileInput.addEventListener("change", selectFile);
    cameraInput.addEventListener("change", selectFile);
    recognizeButton.addEventListener("click", recognize);
    document.getElementById("closeBusinessCardButton").addEventListener("click", close);
    document.getElementById("cancelBusinessCardButton").addEventListener("click", close);
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
    return { open, close };
  };

  async function prepareImage(file) {
      const url = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const source = new Image();
      await new Promise((resolve, reject) => {
        source.onload = resolve;
        source.onerror = reject;
        source.src = url;
      });
      if (!source.naturalWidth || !source.naturalHeight || source.naturalWidth * source.naturalHeight > 40000000) throw new Error("Invalid dimensions");
      const scale = Math.min(1, 2000 / Math.max(source.naturalWidth, source.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
      const context = canvas.getContext("2d");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.9);
      if (!image.startsWith("data:image/jpeg;base64,") || image.length > 4 * 1024 * 1024) throw new Error("Image too large");
      return image;
  }
