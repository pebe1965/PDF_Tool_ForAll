#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import <sys/socket.h>
#import <netinet/in.h>
#import <arpa/inet.h>

@interface AppDelegate : NSObject <NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate>
@property (strong, nonatomic) NSWindow *window;
@property (strong, nonatomic) WKWebView *webView;
@property (strong, nonatomic) NSTask *backendTask;
@property (strong, nonatomic) NSString *serverUrl;
@property (strong, nonatomic) NSTimer *pollTimer;
@property (assign, nonatomic) NSInteger pollAttempts;
@end

static BOOL isPortListening(int port) {
    int sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0) return NO;
    
    struct timeval tv;
    tv.tv_sec = 0;
    tv.tv_usec = 150000; // 150 ms timeout
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, (const char*)&tv, sizeof tv);
    setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, (const char*)&tv, sizeof tv);
    
    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port = htons(port);
    inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr);
    
    int res = connect(sock, (struct sockaddr *)&addr, sizeof(addr));
    close(sock);
    return (res == 0);
}

static NSString *findPythonExecutable(NSString *appDir) {
    NSArray *candidates = @[
        [appDir stringByAppendingPathComponent:@"venv/bin/python3"],
        [appDir stringByAppendingPathComponent:@"../../../../venv/bin/python3"],
        @"/opt/homebrew/bin/python3",
        @"/usr/local/bin/python3",
        @"/usr/bin/python3"
    ];
    NSFileManager *fm = [NSFileManager defaultManager];
    for (NSString *path in candidates) {
        if ([fm isExecutableFileAtPath:path]) {
            return path;
        }
    }
    return nil;
}

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)aNotification {
    [self setupMenus];
    [self setupWindow];
    
    NSString *bundlePath = [[NSBundle mainBundle] bundlePath];
    NSString *appDir = [bundlePath stringByAppendingPathComponent:@"Contents/Resources/app"];
    
    // Fallback falls nicht direkt als Bundle ausgeführt:
    if (![[NSFileManager defaultManager] fileExistsAtPath:appDir]) {
        NSString *execDir = [[NSBundle mainBundle] executablePath].stringByDeletingLastPathComponent;
        appDir = [execDir stringByAppendingPathComponent:@"../Resources/app"];
        if (![[NSFileManager defaultManager] fileExistsAtPath:appDir]) {
            appDir = [[NSFileManager defaultManager] currentDirectoryPath];
        }
    }
    
    // Prüfe bevorzugte Ports (5173, 8080, 8000)
    int ports[] = {5173, 8080, 8000};
    int foundPort = 0;
    for (int i = 0; i < 3; i++) {
        if (isPortListening(ports[i])) {
            foundPort = ports[i];
            break;
        }
    }
    
    if (foundPort > 0) {
        self.serverUrl = [NSString stringWithFormat:@"http://127.0.0.1:%d", foundPort];
        [self loadDashboard];
    } else {
        // Backend starten
        NSString *pyCmd = findPythonExecutable(appDir);
        if (!pyCmd) {
            NSAlert *alert = [[NSAlert alloc] init];
            alert.messageText = @"Python 3 nicht gefunden";
            alert.informativeText = @"Python 3 wurde auf diesem Mac nicht gefunden. Bitte installieren Sie Python 3, um PDF Tool ForAll nutzen zu können.";
            alert.alertStyle = NSAlertStyleCritical;
            [alert addButtonWithTitle:@"Beenden"];
            [alert runModal];
            [NSApp terminate:nil];
            return;
        }
        
        self.backendTask = [[NSTask alloc] init];
        self.backendTask.launchPath = pyCmd;
        self.backendTask.currentDirectoryPath = appDir;
        self.backendTask.arguments = @[@"server.py", @"--no-browser"];
        
        NSMutableDictionary *env = [[[NSProcessInfo processInfo] environment] mutableCopy];
        NSString *curPath = env[@"PATH"] ?: @"/usr/bin:/bin:/usr/sbin:/sbin";
        env[@"PATH"] = [NSString stringWithFormat:@"/opt/homebrew/bin:/usr/local/bin:%@", curPath];
        self.backendTask.environment = env;
        
        @try {
            [self.backendTask launch];
        } @catch (NSException *exception) {
            NSAlert *alert = [[NSAlert alloc] init];
            alert.messageText = @"Fehler beim Starten des Backends";
            alert.informativeText = [NSString stringWithFormat:@"Das Python-Backend konnte nicht gestartet werden: %@", exception.reason];
            alert.alertStyle = NSAlertStyleCritical;
            [alert addButtonWithTitle:@"Beenden"];
            [alert runModal];
            [NSApp terminate:nil];
            return;
        }
        
        self.pollAttempts = 0;
        self.pollTimer = [NSTimer scheduledTimerWithTimeInterval:0.2
                                                          target:self
                                                        selector:@selector(pollServerReady:)
                                                        userInfo:nil
                                                         repeats:YES];
    }
}

- (void)pollServerReady:(NSTimer *)timer {
    self.pollAttempts++;
    int ports[] = {5173, 8080, 8000};
    int foundPort = 0;
    for (int i = 0; i < 3; i++) {
        if (isPortListening(ports[i])) {
            foundPort = ports[i];
            break;
        }
    }
    
    if (foundPort > 0) {
        [self.pollTimer invalidate];
        self.pollTimer = nil;
        self.serverUrl = [NSString stringWithFormat:@"http://127.0.0.1:%d", foundPort];
        [self loadDashboard];
    } else if (self.pollAttempts > 40) { // 8 Sekunden Timeout
        [self.pollTimer invalidate];
        self.pollTimer = nil;
        NSAlert *alert = [[NSAlert alloc] init];
        alert.messageText = @"Start überschritten";
        alert.informativeText = @"Der lokale Server hat nicht rechtzeitig geantwortet.";
        alert.alertStyle = NSAlertStyleWarning;
        [alert addButtonWithTitle:@"Erneut versuchen"];
        [alert addButtonWithTitle:@"Beenden"];
        if ([alert runModal] == NSAlertFirstButtonReturn) {
            self.pollAttempts = 0;
            self.pollTimer = [NSTimer scheduledTimerWithTimeInterval:0.2
                                                              target:self
                                                            selector:@selector(pollServerReady:)
                                                            userInfo:nil
                                                             repeats:YES];
        } else {
            [NSApp terminate:nil];
        }
    }
}

- (void)setupWindow {
    NSRect frame = NSMakeRect(0, 0, 1240, 820);
    NSUInteger style = NSWindowStyleMaskTitled |
                       NSWindowStyleMaskClosable |
                       NSWindowStyleMaskMiniaturizable |
                       NSWindowStyleMaskResizable;
    
    self.window = [[NSWindow alloc] initWithContentRect:frame
                                              styleMask:style
                                                backing:NSBackingStoreBuffered
                                                  defer:NO];
    self.window.title = @"PDF Tool ForAll";
    self.window.minSize = NSMakeSize(780, 560);
    [self.window center];
    [self.window setFrameAutosaveName:@"PDFToolForAllMainWindow"];
    self.window.delegate = self;
    
    WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
    self.webView = [[WKWebView alloc] initWithFrame:self.window.contentView.bounds configuration:config];
    self.webView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    self.webView.navigationDelegate = self;
    self.webView.UIDelegate = self;
    
    [self.window.contentView addSubview:self.webView];
    [self.window makeKeyAndOrderFront:nil];
}

- (void)loadDashboard {
    if (self.serverUrl) {
        NSURL *url = [NSURL URLWithString:self.serverUrl];
        NSURLRequest *req = [NSURLRequest requestWithURL:url];
        [self.webView loadRequest:req];
    }
}

- (BOOL)windowShouldClose:(NSWindow *)sender {
    [self.window orderOut:nil];
    return NO;
}

- (BOOL)applicationShouldHandleReopen:(NSApplication *)sender hasVisibleWindows:(BOOL)flag {
    [self.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];
    return YES;
}

- (NSApplicationTerminateReply)applicationShouldTerminate:(NSApplication *)sender {
    if (self.backendTask && [self.backendTask isRunning]) {
        [self.backendTask terminate];
    }
    return NSTerminateNow;
}

// Download Support in macOS 11.3+ / 12+
- (void)webView:(WKWebView *)webView navigationAction:(WKNavigationAction *)navigationAction didBecomeDownload:(WKDownload *)download {
    download.delegate = self;
}

- (void)webView:(WKWebView *)webView navigationResponse:(WKNavigationResponse *)navigationResponse didBecomeDownload:(WKDownload *)download {
    download.delegate = self;
}

- (void)download:(WKDownload *)download decideDestinationUsingResponse:(NSURLResponse *)response suggestedFilename:(NSString *)suggestedFilename completionHandler:(void (^)(NSURL * _Nullable))completionHandler {
    NSString *downloadsDir = [NSSearchPathForDirectoriesInDomains(NSDownloadsDirectory, NSUserDomainMask, YES) firstObject];
    NSString *destPath = [downloadsDir stringByAppendingPathComponent:suggestedFilename];
    
    NSFileManager *fm = [NSFileManager defaultManager];
    if ([fm fileExistsAtPath:destPath]) {
        NSString *baseName = [suggestedFilename stringByDeletingPathExtension];
        NSString *ext = [suggestedFilename pathExtension];
        int count = 1;
        while ([fm fileExistsAtPath:destPath]) {
            NSString *newName = [NSString stringWithFormat:@"%@ (%d).%@", baseName, count++, ext];
            destPath = [downloadsDir stringByAppendingPathComponent:newName];
        }
    }
    completionHandler([NSURL fileURLWithPath:destPath]);
}

// Öffnet externe Links im Standardbrowser, erlaubt lokale Navigation und Downloads
- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)navigationAction preferences:(WKWebpagePreferences *)preferences decisionHandler:(void (^)(WKNavigationActionPolicy, WKWebpagePreferences *))decisionHandler {
    if (@available(macOS 11.3, *)) {
        if (navigationAction.shouldPerformDownload) {
            decisionHandler(WKNavigationActionPolicyDownload, preferences);
            return;
        }
    }
    
    NSURL *url = navigationAction.request.URL;
    NSString *scheme = url.scheme.lowercaseString;
    
    if ([scheme isEqualToString:@"blob"]) {
        decisionHandler(WKNavigationActionPolicyAllow, preferences);
        return;
    }
    
    NSString *host = url.host;
    if (host && ![host isEqualToString:@"127.0.0.1"] && ![host isEqualToString:@"localhost"]) {
        [[NSWorkspace sharedWorkspace] openURL:url];
        decisionHandler(WKNavigationActionPolicyCancel, preferences);
        return;
    }
    decisionHandler(WKNavigationActionPolicyAllow, preferences);
}

- (WKWebView *)webView:(WKWebView *)webView createWebViewWithConfiguration:(WKWebViewConfiguration *)configuration forNavigationAction:(WKNavigationAction *)navigationAction windowFeatures:(WKWindowFeatures *)windowFeatures {
    if (navigationAction.targetFrame == nil) {
        NSURL *url = navigationAction.request.URL;
        if (url) {
            [[NSWorkspace sharedWorkspace] openURL:url];
        }
    }
    return nil;
}

- (void)setupMenus {
    NSMenu *mainMenu = [[NSMenu alloc] init];
    
    // 1. App Menu
    NSMenuItem *appMenuItem = [[NSMenuItem alloc] init];
    [mainMenu addItem:appMenuItem];
    NSMenu *appMenu = [[NSMenu alloc] initWithTitle:@"PDF Tool ForAll"];
    [appMenuItem setSubmenu:appMenu];
    
    [appMenu addItemWithTitle:@"Über PDF Tool ForAll" action:@selector(orderFrontStandardAboutPanel:) keyEquivalent:@""];
    [appMenu addItem:[NSMenuItem separatorItem]];
    [appMenu addItemWithTitle:@"PDF Tool ForAll ausblenden" action:@selector(hide:) keyEquivalent:@"h"];
    NSMenuItem *hideOthers = [appMenu addItemWithTitle:@"Andere ausblenden" action:@selector(hideOtherApplications:) keyEquivalent:@"h"];
    [hideOthers setKeyEquivalentModifierMask:NSEventModifierFlagOption | NSEventModifierFlagCommand];
    [appMenu addItemWithTitle:@"Alle einblenden" action:@selector(unhideAllApplications:) keyEquivalent:@""];
    [appMenu addItem:[NSMenuItem separatorItem]];
    [appMenu addItemWithTitle:@"PDF Tool ForAll beenden" action:@selector(terminate:) keyEquivalent:@"q"];
    
    // 2. Bearbeiten (Edit) Menu
    NSMenuItem *editMenuItem = [[NSMenuItem alloc] init];
    [mainMenu addItem:editMenuItem];
    NSMenu *editMenu = [[NSMenu alloc] initWithTitle:@"Bearbeiten"];
    [editMenuItem setSubmenu:editMenu];
    
    [editMenu addItemWithTitle:@"Widerrufen" action:@selector(undo:) keyEquivalent:@"z"];
    NSMenuItem *redoItem = [editMenu addItemWithTitle:@"Wiederholen" action:@selector(redo:) keyEquivalent:@"Z"];
    [redoItem setKeyEquivalentModifierMask:NSEventModifierFlagShift | NSEventModifierFlagCommand];
    [editMenu addItem:[NSMenuItem separatorItem]];
    [editMenu addItemWithTitle:@"Ausschneiden" action:@selector(cut:) keyEquivalent:@"x"];
    [editMenu addItemWithTitle:@"Kopieren" action:@selector(copy:) keyEquivalent:@"c"];
    [editMenu addItemWithTitle:@"Einsetzen" action:@selector(paste:) keyEquivalent:@"v"];
    [editMenu addItemWithTitle:@"Alles auswählen" action:@selector(selectAll:) keyEquivalent:@"a"];
    
    // 3. Ansicht (View) Menu
    NSMenuItem *viewMenuItem = [[NSMenuItem alloc] init];
    [mainMenu addItem:viewMenuItem];
    NSMenu *viewMenu = [[NSMenu alloc] initWithTitle:@"Ansicht"];
    [viewMenuItem setSubmenu:viewMenu];
    
    NSMenuItem *reloadItem = [viewMenu addItemWithTitle:@"Neu laden" action:@selector(reloadAction:) keyEquivalent:@"r"];
    reloadItem.target = self;
    
    // 4. Fenster (Window) Menu
    NSMenuItem *windowMenuItem = [[NSMenuItem alloc] init];
    [mainMenu addItem:windowMenuItem];
    NSMenu *windowMenu = [[NSMenu alloc] initWithTitle:@"Fenster"];
    [windowMenuItem setSubmenu:windowMenu];
    
    [windowMenu addItemWithTitle:@"Minimieren" action:@selector(performMiniaturize:) keyEquivalent:@"m"];
    [windowMenu addItemWithTitle:@"Zoomen" action:@selector(performZoom:) keyEquivalent:@""];
    [windowMenu addItem:[NSMenuItem separatorItem]];
    [windowMenu addItemWithTitle:@"Alle nach vorne bringen" action:@selector(arrangeInFront:) keyEquivalent:@""];
    
    [NSApp setMainMenu:mainMenu];
}

- (void)reloadAction:(id)sender {
    [self.webView reload];
}

@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        NSApplication *app = [NSApplication sharedApplication];
        AppDelegate *delegate = [[AppDelegate alloc] init];
        app.delegate = delegate;
        [app run];
    }
    return 0;
}
