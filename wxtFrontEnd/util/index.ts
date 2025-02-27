import { ElMessage, ElMessageBox } from "element-plus";

// 获取配置
export async function getConfig() {
    return await storage.getItem<{
        urlString: string;
        apiKey: string;
        savePath: string;
        cookieString: string;
    }>("local:config");
}
/**
 *  获取当前url的cookies（不包含无痕模式）
 * @returns
 */
export function getUrlCookies() {
    return new Promise<string>((resolve) => {
        browser.runtime.sendMessage({ action: "getCookies" }, (response) => {
            resolve(response.cookie);
        });
    });
}
export const isCookieOk = (str: string) => {
    return str?.includes("user");
};
export const initCookie = async () => {
    // 优先使用配置的cookie，如果未配置则获取当前页面的cookie
    const cache = (await getConfig()) || ({} as any);
    const { cookieString: configuredCookie } = cache;
    const currentCookie = document.cookie;
    if (isCookieOk(currentCookie)) {
        await storage.setItem("local:config", {
            ...cache,
            cookieString: currentCookie,
        });
        return;
    }
    const urlCookie = await getUrlCookies();
    if (isCookieOk(configuredCookie || urlCookie)) {
        // 当前未登录、未配置、但是普通窗口有登陆过
        if (!isCookieOk(configuredCookie) && isCookieOk(urlCookie)) {
            await new Promise<void>((resolve, reject) => {
                ElMessageBox.confirm(
                    "插件：当前页面未登录，已检测到非无痕页面的cookie，是否使用它登录?",
                    "Warning",
                    {
                        type: "warning",
                    }
                )
                    .then(() => {
                        ElMessage({
                            type: "success",
                            message: "登录成功",
                        });
                        resolve();
                    })
                    .catch(() => {
                        ElMessage({
                            type: "info",
                            message: "插件初始化中断，请登录z-lib后使用",
                        });
                        reject();
                    });
            });
        }
        browser.runtime.sendMessage(
            {
                action: "setCookies",
                origin: location.origin,
                cookie: configuredCookie || urlCookie,
            },
            () => {
                location.reload();
            }
        );
    } else {
        ElMessage({
            type: "info",
            message: "如需使用插件，请登录z-lib或者在插件界面设置cookie",
        });
        return Promise.reject();
    }
};