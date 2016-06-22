<?php
/*
 * Copyright 2007-2013 Charles du Jeu - Abstrium SAS <team (at) pyd.io>
 * This file is part of Pydio.
 *
 * Pydio is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Pydio is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Pydio.  If not, see <http://www.gnu.org/licenses/>.
 *
 * The latest code can be found at <http://pyd.io/>.
 */
namespace Pydio\Auth\Frontend;

use __PHP_Incomplete_Class;
use Exception;
use Pydio\Core\Model\Context;
use Pydio\Core\Services\AuthService;
use Pydio\Auth\Frontend\Core\AbstractAuthFrontend;
use Pydio\Core\Services\ConfService;
use Pydio\Core\Services\UsersService;
use Pydio\Core\Utils\BruteForceHelper;
use Pydio\Core\Utils\CookiesHelper;
use Pydio\Core\Utils\Utils;
use Pydio\Core\Controller\XMLWriter;
use Pydio\Core\Utils\CaptchaProvider;

defined('AJXP_EXEC') or die('Access not allowed');


/**
 * Class Pydio\Auth\Frontend\SessionLoginFrontend
 */
class SessionLoginFrontend extends AbstractAuthFrontend
{

    /**
     * Override parent method : disable me if applicationFirstRun ( = installation steps ).
     * @inheritdoc
     */
    function isEnabled()
    {
        if (Utils::detectApplicationFirstRun()) return false;
        return parent::isEnabled();
    }

    /**
     * Try to get the logged user directly from the session
     *
     * @param \Psr\Http\Message\ServerRequestInterface $request
     * @return bool
     * @throws Exception
     * @throws \Pydio\Core\Exception\LoginException
     */
    protected function logUserFromSession(\Psr\Http\Message\ServerRequestInterface &$request)
    {

        if (isSet($_SESSION["AJXP_USER"]) && !$_SESSION["AJXP_USER"] instanceof __PHP_Incomplete_Class && $_SESSION["AJXP_USER"] instanceof \Pydio\Core\Model\UserInterface) {
            /**
             * @var \Pydio\Conf\Core\AbstractAjxpUser $u
             */
            $u = $_SESSION["AJXP_USER"];
            if ($u->reloadRolesIfRequired()) {
                ConfService::getInstance()->invalidateLoadedRepositories();
                AuthService::$bufferedMessage = XMLWriter::reloadRepositoryList(false);
            }
            $request = $request->withAttribute("ctx", Context::contextWithObjects($u, null));
            return true;
        }

        if (ConfService::getGlobalConf("ALLOW_GUEST_BROWSING", "auth") && !isSet($_SESSION["CURRENT_MINISITE"])) {

            $authDriver = ConfService::getAuthDriverImpl();
            if (!$authDriver->userExists("guest")) {
                $guest = UsersService::createUser("guest", "");
                $guest->save("superuser");
            }
            $logged = AuthService::logUser("guest", null);
            $request = $request->withAttribute("ctx", Context::contextWithObjects($logged, null));
            return true;
        }
        return false;

    }

    /**
     * Try to log the user from a submitted "login" action.
     * @param \Psr\Http\Message\ServerRequestInterface $requestInterface
     * @param \Psr\Http\Message\ResponseInterface $responseInterface
     * @param bool $isLast
     * @return \Psr\Http\Message\ResponseInterface|static
     */
    function logUserFromLoginAction(\Psr\Http\Message\ServerRequestInterface &$requestInterface, \Psr\Http\Message\ResponseInterface &$responseInterface, $isLast = false)
    {

        $httpVars = $requestInterface->getParsedBody();
        $rememberLogin = "";
        $rememberPass = "";
        $secureToken = "";
        $loggedUser = null;
        $cookieLogin = (isSet($httpVars["cookie_login"]) ? true : false);
        if (BruteForceHelper::suspectBruteForceLogin() && (!isSet($httpVars["captcha_code"]) || !CaptchaProvider::checkCaptchaResult($httpVars["captcha_code"]))) {

            $loggingResult = -4;

        } else if ($cookieLogin && !CookiesHelper::hasRememberCookie()) {

            $loggingResult = -5;

        } else {

            if ($cookieLogin) {
                list($userId, $userPass) = CookiesHelper::getRememberCookieData();
            } else {
                $userId = (isSet($httpVars["userid"]) ? Utils::sanitize($httpVars["userid"], AJXP_SANITIZE_EMAILCHARS) : null);
                $userPass = (isSet($httpVars["password"]) ? trim($httpVars["password"]) : null);
            }
            $rememberMe = ((isSet($httpVars["remember_me"]) && $httpVars["remember_me"] == "true") ? true : false);
            $loggingResult = 1;

            try {

                $loggedUser = AuthService::logUser($userId, $userPass, false, $cookieLogin, $httpVars["login_seed"]);
                $requestInterface = $requestInterface->withAttribute("ctx", Context::contextWithObjects($loggedUser, null));

            } catch (\Pydio\Core\Exception\LoginException $l) {

                $loggingResult = $l->getLoginError();

            }

            if ($rememberMe && $loggingResult == 1) {
                $rememberLogin = "notify";
                $rememberPass = "notify";
            }
            if ($loggingResult == 1) {
                session_regenerate_id(true);
                $secureToken = \Pydio\Core\Http\Middleware\SecureTokenMiddleware::generateSecureToken();
            }
            if ($loggingResult < 1 && BruteForceHelper::suspectBruteForceLogin()) {
                $loggingResult = -4; // Force captcha reload
            }
        }

        if ($loggedUser != null) {

            if (ConfService::getGlobalConf("ALLOW_GUEST_BROWSING", "auth")) {
                ConfService::getInstance()->invalidateLoadedRepositories();
            }

        }

        if ($loggedUser != null && (CookiesHelper::hasRememberCookie() || (isSet($rememberMe) && $rememberMe == true))) {
            CookiesHelper::refreshRememberCookie($loggedUser);
        }

        $stream = new \Pydio\Core\Http\Response\SerializableResponseStream();
        $stream->addChunk(new \Pydio\Core\Http\Message\LoggingResult($loggingResult, $rememberLogin, $rememberPass, $secureToken));
        $responseInterface = $responseInterface->withBody($stream);

        return $responseInterface;

    }

    /**
     * Authfront implementation
     * @param \Psr\Http\Message\ServerRequestInterface $request
     * @param \Psr\Http\Message\ResponseInterface $response
     * @param bool $isLast
     * @return bool
     */
    function tryToLogUser(\Psr\Http\Message\ServerRequestInterface &$request, \Psr\Http\Message\ResponseInterface &$response, $isLast = false)
    {

        if ($request->getAttribute("action") === "login") {

            return $this->logUserFromLoginAction($request, $response, $isLast);

        } else {

            return $this->logUserFromSession($request);

        }

    }

    /**
     * Action controller method
     * @param \Psr\Http\Message\ServerRequestInterface $requestInterface
     * @param \Psr\Http\Message\ResponseInterface $responseInterface
     * @return string
     */
    public function switchAction(\Psr\Http\Message\ServerRequestInterface &$requestInterface, \Psr\Http\Message\ResponseInterface &$responseInterface)
    {
        switch ($requestInterface->getAttribute("action")) {

            case "login":

                break;

            case "logout" :

                AuthService::disconnect();
                $loggingResult = 2;
                session_destroy();
                $x = new \Pydio\Core\Http\Response\SerializableResponseStream();
                $x->addChunk(new \Pydio\Core\Http\Message\LoggingResult($loggingResult));
                $responseInterface = $responseInterface->withBody($x);

                break;

            case "get_seed" :

                $seed = AuthService::generateSeed();
                if (BruteForceHelper::suspectBruteForceLogin()) {
                    $responseInterface = new \Zend\Diactoros\Response\JsonResponse(["seed" => $seed, "captcha" => true]);
                } else {
                    $responseInterface = $responseInterface->withHeader("Content-Type", "text/plain");
                    $responseInterface->getBody()->write($seed);
                }
                break;

            case "get_captcha":

                $x = new \Pydio\Core\Http\Response\AsyncResponseStream(function () {
                    restore_error_handler();
                    restore_exception_handler();
                    set_error_handler(function ($code, $message, $script) {
                        if (error_reporting() == 0) return;
                        \Pydio\Log\Core\AJXP_Logger::error("Captcha", "Error while loading captcha : " . $message, []);
                    });
                    CaptchaProvider::sendCaptcha();
                    return "";
                });
                $responseInterface = $responseInterface->withBody($x);
                break;

            case "back":

                $responseInterface = $responseInterface->withHeader("Content-Type", "text/xml");
                $responseInterface->getBody()->write("<url>" . UsersService::getLogoutAddress() . "</url>");
                break;

            default;
                break;
        }
        return "";
    }


} 