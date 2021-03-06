<?php
/*
 * Copyright 2007-2016 Charles du Jeu - Abstrium SAS <team (at) pyd.io>
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
 * The latest code can be found at <https://pydio.com>.
 */
namespace Pydio\Core\Exception;

use Pydio\Core\Http\Middleware\WorkspaceAuthMiddleware;
use Pydio\Core\Http\Response\JSONSerializableResponseChunk;
use Pydio\Core\Http\Response\XMLSerializableResponseChunk;

defined('AJXP_EXEC') or die( 'Access not allowed');

define('AJXP_PROMPT_EXCEPTION_PROMPT', 'AJXP_PROMPT_EXCEPTION_PROMPT');
define('AJXP_PROMPT_EXCEPTION_CONFIRM', 'AJXP_PROMPT_EXCEPTION_CONFIRM');
define('AJXP_PROMPT_EXCEPTION_ALERT', 'AJXP_PROMPT_EXCEPTION_ALERT');

/**
 * Class AJXP_PromptException
 * Specific exception that triggers a prompt in the UI instead of displaying an error message.
 *
 * @package Pydio
 * @subpackage Core
 */
class PydioPromptException extends PydioException implements XMLSerializableResponseChunk, JSONSerializableResponseChunk
{

    private $promptType = "prompt";
    /**
     * @var array
     */
    private $promptData = array();

    /**
     * @return array
     */
    public function getPromptData()
    {
        return $this->promptData;
    }

    /**
     * @return string
     */
    public function getPromptType()
    {
        return $this->promptType;
    }

    /**
     * @param $promptType
     * @param array $data
     * @param String $messageString
     * @param string|bool $messageId
     */
    public function __construct($promptType, $data, $messageString, $messageId = false)
    {
        $this->promptType = $promptType;
        $this->promptData = $data;
        parent::__construct($messageString, $messageId);
    }


    /**
     * Prompt user for credentials
     * @param array $parameters
     * @param string $postSubmitCallback
     * @return  PydioPromptException
     */
    public static function promptForWorkspaceCredentials($parameters, $postSubmitCallback = ""){
        $inputs = [];
        foreach($parameters as $key => $value){
            if($key === WorkspaceAuthMiddleware::FORM_RESUBMIT_LOGIN) {
                $inputs[] = "<input type='text' name='$key' value='$value' placeholder='Login'>";
            }else if($key === WorkspaceAuthMiddleware::FORM_RESUBMIT_PASS){
                $inputs[] = "<input type='password' name='$key' value='' placeholder='Password' autocomplete='off'>";
            }else{
                $inputs[] = "<input type='hidden' name='$key' value='$value'>";
            }
        }
        return new PydioPromptException(
            "confirm",
            array(
                "DIALOG" => "<div>
                                <h3>Credentials Required</h3>
                                <div class='dialogLegend'>Please provide a password to enter this workspace.</div>
                                <form autocomplete='off'>
                                    ".implode("\n", $inputs)."
                                </form>
                            </div>
                            ",
                "OK"        => array(
                    "GET_FIELDS" => array_keys($parameters),
                    "EVAL" => $postSubmitCallback
                ),
                "CANCEL"    => array(
                    "EVAL" => ""
                )
            ),
            "Credentials Needed");

    }

    /**
     * @return mixed
     */
    public function jsonSerializableData()
    {
        return [
            "promptType" => $this->promptType,
            "promptMessage" => $this->getMessage(),
            "promptData" => $this->promptData
        ];
    }

    /**
     * @return string
     */
    public function jsonSerializableKey()
    {
        return "userPrompt";
    }

    /**
     * @return string
     */
    public function toXML()
    {
        return "<prompt type=\"".$this->promptType."\"><message>".$this->getMessage()."</message><data><![CDATA[".json_encode($this->promptData)."]]></data></prompt>";
    }


}